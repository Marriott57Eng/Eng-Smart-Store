export interface ServerLineConfig {
  enabled: boolean;
  channelAccessToken: string;
  destinationId: string;
  notifyStockOut: boolean;
  notifyStockIn: boolean;
  notifyLogin: boolean;
  notifyLogout: boolean;
  notifyLowStock?: boolean;
  notifyPurchaseOrder?: boolean;
  useSeparateOrderDestination?: boolean;
  purchaseOrderDestinationId?: string;
  purchaseOrderChannelAccessToken?: string;
}

// In-memory config initialized with imported tokens from the previous app and overridable via Firestore
let serverLineConfig: ServerLineConfig = {
  enabled: true,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '9Q8ELV/INC2ERe2iG4ynfet8R8KnAygHHxgaGlPH6iCEX5/Ix5s/t7UORE+UftHLMQcsmL5fRu1OVBBBjDlBvXkAEPLpTjKnN9Osq7xgOw3ZKurF7kbu8HvVdP6NesC/RlkcyCLjSJV0L7puMiVlSwdB04t89/1O/w1cDnyilFU=',
  destinationId: process.env.LINE_DESTINATION_ID || 'Ud3217b5c26f2624b19c6f7eae5ab209c',
  notifyStockOut: true,
  notifyStockIn: true,
  notifyLogin: false,
  notifyLogout: false,
  notifyLowStock: true,
  notifyPurchaseOrder: true,
  useSeparateOrderDestination: true,
  purchaseOrderDestinationId: process.env.LINE_PO_DESTINATION_ID || 'U02c89d2e8c0a7eea3cada8e1c2bcf814',
  purchaseOrderChannelAccessToken: process.env.LINE_PO_CHANNEL_ACCESS_TOKEN || 'ANHC/PZy9Vwxau92pp0xGa3+RofwsQQKxceHGZT9cA4xd20gRPrXnWC00OPsKOTIP/rV/6HgeOcDcbig2DDcJlvYzlxlO5Zqh5v1EmCLyqnnDHAGz6Posp3850I7XRLRa8moPnCef1XqSeN9D1GlcAdB04t89/1O/w1cDnyilFU=',
};

export const updateServerLineConfig = (newConfig: Partial<ServerLineConfig>) => {
  serverLineConfig = {
    ...serverLineConfig,
    ...newConfig,
  };
  return serverLineConfig;
};

export const getServerLineConfig = (): ServerLineConfig => {
  return serverLineConfig;
};

/**
 * Send push message via LINE Messaging API
 */
export const pushLineMessage = async (
  messages: any[],
  customToken?: string,
  customDestination?: string
): Promise<{ success: boolean; error?: string; skipped?: boolean }> => {
  const rawToken = (customToken || serverLineConfig.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const rawDestination = (customDestination || serverLineConfig.destinationId || process.env.LINE_DESTINATION_ID || '').trim();

  // Clean token from quotes, spaces, or accidentally pasted "Bearer " prefixes
  const token = rawToken.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
  const destination = rawDestination.replace(/^["']|["']$/g, '').trim();

  if (!token) {
    return { success: false, skipped: true, error: 'LINE Channel Access Token ยังไม่ได้กำหนดค่า' };
  }
  if (!destination) {
    return { success: false, skipped: true, error: 'LINE Destination ID (User ID / Group ID) ยังไม่ได้กำหนดค่า' };
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: destination,
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errMsg = `LINE API HTTP ${response.status}`;
      try {
        const json = JSON.parse(errorBody);
        if (json.message) errMsg = json.message;
        if (json.details && json.details.length > 0) {
          errMsg += ` (${json.details.map((d: any) => d.message).join(', ')})`;
        }
      } catch (_) {}

      // Handle common LINE API error scenarios with clear guidance
      if (response.status === 401) {
        errMsg = 'รหัส Token ไม่ถูกต้องหรือหมดอายุ (401 Authentication failed): กรุณาตรวจสอบว่าคัดลอก "Channel access token (long-lived)" จากแท็บ Messaging API ใน LINE Developers Console (ห้ามใช้ Channel Secret ใน Basic settings)';
      } else if (response.status === 400) {
        errMsg = `ข้อมูลปลายทางไม่ถูกต้อง (400 Bad Request): ตรวจสอบ Destination ID "${destination}" (ต้องเป็น User ID ขึ้นต้นด้วย U... หรือ Group ID ขึ้นต้นด้วย C.../R... และบอทต้องอยู่ในกลุ่มนั้น)`;
      }

      console.warn('LINE Messaging API notice:', response.status, errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Failed to call LINE API:', err?.message || err);
    return { success: false, error: err?.message || 'Network connection to LINE API failed' };
  }
};

/**
 * Send Purchase Order message (Order request / Order Confirmed) specifically to the
 * dedicated Purchase Order LINE Destination and Token if configured, or general LINE destination.
 */
export const pushPurchaseOrderLineMessage = async (
  messages: any[]
): Promise<{ success: boolean; error?: string; skipped?: boolean }> => {
  const config = getServerLineConfig();
  const useDedicatedOrder = Boolean(config.useSeparateOrderDestination && config.purchaseOrderDestinationId);

  const targetDestination = useDedicatedOrder 
    ? config.purchaseOrderDestinationId! 
    : config.destinationId;

  const targetToken = (useDedicatedOrder && config.purchaseOrderChannelAccessToken)
    ? config.purchaseOrderChannelAccessToken
    : config.channelAccessToken;

  return pushLineMessage(messages, targetToken, targetDestination);
};

/**
 * Build Flex Message for Stock Transaction (Stock In / Stock Out)
 */
export const createStockFlexMessage = (data: {
  type: 'in' | 'out';
  itemId: string;
  itemName: string;
  category?: string;
  qty: number;
  unit: string;
  location?: string;
  requestedBy: string;
  purpose?: string;
  timestamp?: string;
  previousQty?: number;
  newQty?: number;
  status?: 'normal' | 'low' | 'out';
}) => {
  const isStockIn = data.type === 'in';
  const headerBgColor = isStockIn ? '#059669' : '#DC2626'; // Emerald for In, Red for Out
  const headerTitle = isStockIn ? '📥 แจ้งเตือนรับเข้าสินค้า (Stock In)' : '📤 แจ้งเตือนการเบิกสินค้า (Stock Out)';
  const qtyPrefix = isStockIn ? '+' : '-';
  const qtyBadgeColor = isStockIn ? '#059669' : '#DC2626';

  const timeStr = data.timestamp || new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const remainingQty = data.newQty !== undefined ? data.newQty : null;

  return {
    type: 'flex',
    altText: `${headerTitle}: ${data.itemName} (${qtyPrefix}${data.qty} ${data.unit})`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBgColor,
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: headerTitle,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ENG SMART STORE • Store FL.6',
            color: '#FFFFFFCC',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          // Item Name
          {
            type: 'text',
            text: data.itemName,
            weight: 'bold',
            size: 'lg',
            color: '#1E293B',
            wrap: true,
          },
          // Item Code & Category
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: `รหัส: ${data.itemId}`,
                size: 'xs',
                color: '#64748B',
                flex: 0,
              },
              {
                type: 'text',
                text: data.category ? ` • หมวด: ${data.category}` : '',
                size: 'xs',
                color: '#64748B',
                flex: 1,
              },
            ],
          },
          {
            type: 'separator',
            margin: 'lg',
            color: '#E2E8F0',
          },
          // Transaction Details Table
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              // Quantity
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: isStockIn ? 'จำนวนที่รับเข้า' : 'จำนวนที่เบิก',
                    size: 'sm',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: `${qtyPrefix}${data.qty} ${data.unit}`,
                    size: 'md',
                    weight: 'bold',
                    color: qtyBadgeColor,
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              // Remaining Stock (if known)
              ...(remainingQty !== null
                ? [
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: 'คงเหลือในคลัง',
                          size: 'sm',
                          color: '#64748B',
                          flex: 4,
                        },
                        {
                          type: 'text',
                          text: `${remainingQty} ${data.unit} ${remainingQty <= 0 ? '(หมดสต็อก!)' : ''}`,
                          size: 'sm',
                          weight: 'bold',
                          color: remainingQty <= 0 ? '#DC2626' : '#1E293B',
                          align: 'end',
                          flex: 6,
                        },
                      ],
                    },
                  ]
                : []),
              // Location
              ...(data.location
                ? [
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: 'ตำแหน่งจัดเก็บ',
                          size: 'sm',
                          color: '#64748B',
                          flex: 4,
                        },
                        {
                          type: 'text',
                          text: data.location,
                          size: 'sm',
                          color: '#1E293B',
                          align: 'end',
                          flex: 6,
                        },
                      ],
                    },
                  ]
                : []),
              // Requested / Performed By
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: isStockIn ? 'ผู้รับเข้า' : 'ผู้เบิก',
                    size: 'sm',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: data.requestedBy || 'ไม่ระบุ',
                    size: 'sm',
                    weight: 'bold',
                    color: '#1E293B',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              // Purpose / Job
              ...(data.purpose
                ? [
                    {
                      type: 'box',
                      layout: 'horizontal',
                      contents: [
                        {
                          type: 'text',
                          text: isStockIn ? 'แหล่งที่มา' : 'งาน/วัตถุประสงค์',
                          size: 'sm',
                          color: '#64748B',
                          flex: 4,
                        },
                        {
                          type: 'text',
                          text: data.purpose,
                          size: 'sm',
                          color: '#1E293B',
                          align: 'end',
                          wrap: true,
                          flex: 6,
                        },
                      ],
                    },
                  ]
                : []),
              // Time
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'เวลาทำรายการ',
                    size: 'xs',
                    color: '#94A3B8',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: timeStr,
                    size: 'xs',
                    color: '#94A3B8',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
};

/**
 * Build Flex Message for User Authentication (Login / Logout)
 */
export const createAuthFlexMessage = (data: {
  type: 'login' | 'logout';
  userId: string;
  username: string;
  name: string;
  nickname?: string;
  role: 'admin' | 'user';
  timestamp?: string;
}) => {
  const isLogin = data.type === 'login';
  const headerBgColor = isLogin ? '#2563EB' : '#475569'; // Blue for Login, Slate for Logout
  const headerTitle = isLogin ? '🟢 แจ้งเตือนเข้าสู่ระบบ (User Login)' : '🔴 แจ้งเตือนออกจากระบบ (User Logout)';
  const roleLabel = data.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้ทั่วไป (Staff)';

  const timeStr = data.timestamp || new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const displayName = data.nickname ? `${data.name} (${data.nickname})` : data.name;

  return {
    type: 'flex',
    altText: `${headerTitle}: ${displayName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBgColor,
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: headerTitle,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ENG SMART STORE • Security & Session',
            color: '#FFFFFFCC',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          // User Name
          {
            type: 'text',
            text: displayName,
            weight: 'bold',
            size: 'lg',
            color: '#1E293B',
            wrap: true,
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#E2E8F0',
          },
          // Details
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'รหัสพนักงาน (ID)',
                    size: 'sm',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: data.userId || data.username,
                    size: 'sm',
                    weight: 'bold',
                    color: '#1E293B',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'สิทธิ์การใช้งาน',
                    size: 'sm',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: roleLabel,
                    size: 'sm',
                    weight: 'bold',
                    color: data.role === 'admin' ? '#4F46E5' : '#059669',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'เวลาทำรายการ',
                    size: 'xs',
                    color: '#94A3B8',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: timeStr,
                    size: 'xs',
                    color: '#94A3B8',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
};

/**
 * Build Flex Message for Bulk Stock Out
 */
export const createBulkStockFlexMessage = (data: {
  type?: 'in' | 'out';
  documentNumber?: string;
  supplierName?: string;
  items: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    unit: string;
    newQty?: number;
  }>;
  requestedBy: string;
  purpose: string;
  timestamp?: string;
}) => {
  const isStockIn = data.type === 'in';
  const headerBgColor = isStockIn ? '#059669' : '#2563EB'; // Emerald Green for In, Royal Blue for Out
  const headerTitle = isStockIn 
    ? `📥 แจ้งเตือนรับสินค้าเข้าคลัง (${data.items.length} รายการ)`
    : `📤 แจ้งเตือนการเบิกหลายรายการ (${data.items.length} รายการ)`;
  const totalUnits = data.items.reduce((sum, i) => sum + i.qty, 0);

  const timeStr = data.timestamp || new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemBoxes: any[] = data.items.slice(0, 12).map((item) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: `• ${item.itemName}`,
        size: 'xs',
        color: '#1E293B',
        flex: 3,
        wrap: true,
      },
      {
        type: 'text',
        text: `${isStockIn ? '+' : '-'}${item.qty} ${item.unit}`,
        size: 'xs',
        weight: 'bold',
        color: isStockIn ? '#059669' : '#DC2626',
        align: 'end',
        flex: 1,
      }
    ]
  }));

  return {
    type: 'flex',
    altText: `${headerTitle}: รวม ${totalUnits} ชิ้น โดย ${data.requestedBy}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBgColor,
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: headerTitle,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ENG SMART STORE • Store FL.6',
            color: '#FFFFFFCC',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: isStockIn ? 'รายการสินค้าที่รับเข้า:' : 'รายการสินค้าที่เบิก:',
                weight: 'bold',
                size: 'sm',
                color: '#334155',
              },
              {
                type: 'text',
                text: `รวม ${totalUnits} ชิ้น`,
                weight: 'bold',
                size: 'xs',
                color: isStockIn ? '#059669' : '#2563EB',
                align: 'end',
              }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'sm',
            spacing: 'xs',
            contents: itemBoxes
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#E2E8F0',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              ...(data.documentNumber ? [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: '📄 เลขที่เอกสาร:', size: 'xs', color: '#64748B', flex: 2 },
                    { type: 'text', text: data.documentNumber, size: 'xs', weight: 'bold', color: '#059669', flex: 4, align: 'end' },
                  ]
                }
              ] : []),
              ...(data.supplierName ? [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: '🏢 ซัพพลายเออร์:', size: 'xs', color: '#64748B', flex: 2 },
                    { type: 'text', text: data.supplierName, size: 'xs', weight: 'bold', color: '#1E293B', flex: 4, align: 'end' },
                  ]
                }
              ] : []),
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: isStockIn ? '👤 ผู้รับเข้า:' : '👤 ผู้เบิก:', size: 'xs', color: '#64748B', flex: 2 },
                  { type: 'text', text: data.requestedBy, size: 'xs', weight: 'bold', color: '#1E293B', flex: 4, align: 'end' },
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: isStockIn ? '📦 แหล่งที่มา/งาน:' : '🎯 วัตถุประสงค์:', size: 'xs', color: '#64748B', flex: 2 },
                  { type: 'text', text: data.purpose || (isStockIn ? 'รับเข้าจากใบส่งของ' : 'ใช้งานทั่วไป'), size: 'xs', color: '#1E293B', flex: 4, align: 'end', wrap: true },
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🕒 เวลาบันทึก:', size: 'xs', color: '#64748B', flex: 2 },
                  { type: 'text', text: timeStr, size: 'xs', color: '#64748B', flex: 4, align: 'end' },
                ]
              },
            ]
          }
        ],
      },
    },
  };
};

/**
 * Build Test Flex Message
 */
export const createTestFlexMessage = () => {
  const timeStr = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    type: 'flex',
    altText: '🚀 การทดสอบระบบแจ้งเตือน LINE สำเร็จ!',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#06C755', // Official LINE Green
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: '🚀 เชื่อมต่อ LINE สำเร็จแล้ว!',
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: 'ENG SMART STORE • Notification Center',
            color: '#FFFFFFCC',
            size: 'xxs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: 'ระบบพร้อมส่งการแจ้งเตือน',
            weight: 'bold',
            size: 'md',
            color: '#1E293B',
          },
          {
            type: 'text',
            text: 'ระบบพร้อมส่งข้อความแจ้งเตือนอัตโนมัติเมื่อเกิดรายการต่อไปนี้:',
            size: 'xs',
            color: '#64748B',
            margin: 'sm',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'xs',
            contents: [
              {
                type: 'text',
                text: '• 📤 การเบิกสินค้า (Stock Out)',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: '• 📥 การรับเข้าสินค้า (Stock In)',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: '• 🟢 การเข้าสู่ระบบ (User Login)',
                size: 'xs',
                color: '#334155',
              },
              {
                type: 'text',
                text: '• 🔴 การออกจากระบบ (User Logout)',
                size: 'xs',
                color: '#334155',
              },
            ],
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#E2E8F0',
          },
          {
            type: 'text',
            text: `ทดสอบเมื่อ: ${timeStr}`,
            size: 'xxs',
            color: '#94A3B8',
            margin: 'md',
            align: 'end',
          },
        ],
      },
    },
  };
};

/**
 * Build Flex Message for Purchase Order (สั่งซื้อสินค้าใกล้หมด/หมด)
 * Contains interactive button to confirm order directly from LINE!
 */
export const createPurchaseOrderFlexMessage = (data: {
  order: {
    id: string;
    itemId: string;
    itemName: string;
    category?: string;
    qty: number;
    unit: string;
    currentQty?: number;
    minStock?: number;
    location?: string;
    requestedBy: string;
    brand?: string;
    model?: string;
    supplier?: string;
    note?: string;
    urgency?: 'normal' | 'urgent' | 'critical';
    status?: 'pending' | 'confirmed' | 'received' | 'cancelled';
    confirmedBy?: string;
    confirmedAt?: string;
    createdAt?: string;
    confirmationToken?: string | null;
  };
  baseUrl?: string;
}) => {
  const order = data.order;
  const isConfirmed = order.status === 'confirmed' || order.status === 'received' || Boolean(order.confirmedAt);
  const rawBaseUrl = data.baseUrl || process.env.APP_URL || 'https://ais-pre-z3k4f7ddsky5bcj5xkcsjl-848857945854.asia-east1.run.app';
  const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
  
  const tokenParam = order.confirmationToken ? `&token=${encodeURIComponent(order.confirmationToken)}` : '';
  const confirmUrl = `${cleanBaseUrl}/api/orders/confirm?orderId=${encodeURIComponent(order.id)}${tokenParam}`;
  const webAppUrl = `${cleanBaseUrl}/?tab=admin&subtab=orders&orderId=${encodeURIComponent(order.id)}`;

  const urgencyText = order.urgency === 'critical' 
    ? '🔥 ด่วนที่สุด (Critical)' 
    : order.urgency === 'urgent' 
    ? '⚡ ด่วน (Urgent)' 
    : 'ปกติ';
  const urgencyColor = order.urgency === 'critical' 
    ? '#DC2626' 
    : order.urgency === 'urgent' 
    ? '#EA580C' 
    : '#475569';

  return {
    type: 'flex',
    altText: isConfirmed 
      ? `✅ ยืนยันแล้ว: ${order.itemName} (${order.qty} ${order.unit})` 
      : `🛒 แจ้งเตือนสั่งซื้อสินค้า: ${order.itemName} (${order.qty} ${order.unit})`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: isConfirmed ? '#059669' : '#D97706', // Emerald if confirmed, Amber if pending
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: isConfirmed ? '✅ คำสั่งซื้อได้รับการยืนยันแล้ว' : '🛒 คำสั่งซื้อสินค้าใหม่ (Purchase Order)',
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: `เลขที่ใบสั่งซื้อ: ${order.id}`,
            color: isConfirmed ? '#D1FAE5' : '#FEF3C7',
            size: 'xs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          // Item Name
          {
            type: 'text',
            text: order.itemName,
            weight: 'bold',
            size: 'xl',
            color: '#0F172A',
            wrap: true,
          },
          // Item Code & Category
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: `รหัส: ${order.itemId}${order.category ? ` • หมวด: ${order.category}` : ''}`,
                size: 'xs',
                color: '#475569',
                weight: 'bold',
                wrap: true,
              },
            ],
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#F1F5F9',
          },
          // Quantity ordered highlight box
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            backgroundColor: isConfirmed ? '#ECFDF5' : '#FFFBEB',
            borderWidth: '1px',
            borderColor: isConfirmed ? '#A7F3D0' : '#FDE68A',
            cornerRadius: '12px',
            paddingAll: '14px',
            alignItems: 'center',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 6,
                contents: [
                  {
                    type: 'text',
                    text: 'จำนวนที่สั่งซื้อ:',
                    size: 'xs',
                    color: isConfirmed ? '#047857' : '#92400E',
                    weight: 'bold',
                  },
                  {
                    type: 'text',
                    text: `${order.qty.toLocaleString()} ${order.unit}`,
                    size: 'xxl',
                    color: isConfirmed ? '#059669' : '#B45309',
                    weight: 'bold',
                    wrap: true,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 4,
                contents: [
                  {
                    type: 'text',
                    text: 'สต็อกคงเหลือ:',
                    size: 'xs',
                    color: '#64748B',
                    align: 'end',
                  },
                  {
                    type: 'text',
                    text: `${order.currentQty ?? '-'} ${order.unit}`,
                    size: 'md',
                    color: '#DC2626',
                    weight: 'bold',
                    align: 'end',
                    wrap: true,
                  },
                  {
                    type: 'text',
                    text: `(ขั้นต่ำ ${order.minStock ?? '-'})`,
                    size: 'xxs',
                    color: '#94A3B8',
                    align: 'end',
                  },
                ],
              },
            ],
          },
          // Key details table
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'ผู้ขอสั่งซื้อ:',
                    size: 'xs',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: order.requestedBy || 'ไม่ระบุ',
                    size: 'xs',
                    color: '#1E293B',
                    weight: 'bold',
                    flex: 6,
                    align: 'end',
                  },
                ],
              },
              ...(order.brand ? [{
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'ยี่ห้อ (Brand):',
                    size: 'xs',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: order.brand,
                    size: 'xs',
                    color: '#D97706',
                    weight: 'bold',
                    flex: 6,
                    align: 'end',
                  },
                ],
              }] : []),
              ...(order.model ? [{
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'รุ่น (Model):',
                    size: 'xs',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: order.model,
                    size: 'xs',
                    color: '#2563EB',
                    weight: 'bold',
                    flex: 6,
                    align: 'end',
                  },
                ],
              }] : []),
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'ความเร่งด่วน:',
                    size: 'xs',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: urgencyText,
                    size: 'xs',
                    color: urgencyColor,
                    weight: 'bold',
                    flex: 6,
                    align: 'end',
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'หมายเหตุ:',
                    size: 'xs',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: order.note || 'เติมสต็อกตามเกณฑ์ขั้นต่ำ',
                    size: 'xs',
                    color: '#334155',
                    wrap: true,
                    flex: 6,
                    align: 'end',
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'สถานะ:',
                    size: 'xs',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: isConfirmed ? `✅ ยืนยันแล้ว (${order.confirmedBy || 'ผู้ดูแลระบบ'})` : '⏳ รอการยืนยันสั่งซื้อ',
                    size: 'xs',
                    color: isConfirmed ? '#059669' : '#D97706',
                    weight: 'bold',
                    flex: 6,
                    align: 'end',
                  },
                ],
              },
              ...(isConfirmed && order.confirmedAt ? [{
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'เวลายืนยัน:',
                    size: 'xs',
                    color: '#64748B',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: order.confirmedAt,
                    size: 'xs',
                    color: '#059669',
                    weight: 'bold',
                    flex: 6,
                    align: 'end',
                  },
                ],
              }] : []),
            ],
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#E2E8F0',
          },
          {
            type: 'text',
            text: `สั่งซื้อเมื่อ: ${order.createdAt || new Date().toLocaleString('th-TH')}`,
            size: 'xxs',
            color: '#94A3B8',
            margin: 'md',
            align: 'end',
          },
        ],
      },
      // If confirmed, footer is completely omitted (no confirm button, no lock bar, no check items button).
      // If pending, only show the one-click confirm button.
      ...(!isConfirmed ? {
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '14px',
          backgroundColor: '#F8FAFC',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#059669',
              height: 'sm',
              action: {
                type: 'uri',
                label: '✅ ยืนยันการสั่งซื้อทันที',
                uri: confirmUrl,
              },
            },
          ],
        },
      } : {}),
    },
  };
};

/**
 * Build Flex Message for Purchase Order Confirmation notification
 */
export const createOrderConfirmedFlexMessage = (data: {
  order: {
    id: string;
    itemId: string;
    itemName: string;
    qty: number;
    unit: string;
    confirmedBy: string;
    confirmedAt: string;
  };
  baseUrl?: string;
}) => {
  const { order } = data;
  const rawBaseUrl = data.baseUrl || process.env.APP_URL || 'https://ais-pre-z3k4f7ddsky5bcj5xkcsjl-848857945854.asia-east1.run.app';
  const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
  const webAppUrl = `${cleanBaseUrl}/?tab=admin&subtab=orders&orderId=${encodeURIComponent(order.id)}`;

  return {
    type: 'flex',
    altText: `✅ ยืนยันการสั่งซื้อแล้ว: ${order.itemName} (${order.qty} ${order.unit})`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#059669', // Emerald
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: '✅ อนุมัติ/ยืนยันการสั่งซื้อแล้ว',
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
          },
          {
            type: 'text',
            text: `ใบสั่งซื้อ: ${order.id}`,
            color: '#D1FAE5',
            size: 'xs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '18px',
        contents: [
          {
            type: 'text',
            text: order.itemName,
            weight: 'bold',
            size: 'xl',
            color: '#0F172A',
            wrap: true,
          },
          {
            type: 'text',
            text: `รหัสอะไหล่: ${order.itemId}`,
            size: 'xs',
            weight: 'bold',
            color: '#475569',
            margin: 'xs',
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            backgroundColor: '#ECFDF5',
            borderWidth: '1px',
            borderColor: '#A7F3D0',
            cornerRadius: '10px',
            paddingAll: '12px',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: 'จำนวนสั่งซื้อ',
                size: 'sm',
                weight: 'bold',
                color: '#065F46',
                flex: 5,
              },
              {
                type: 'text',
                text: `${order.qty.toLocaleString()} ${order.unit}`,
                size: 'xl',
                color: '#059669',
                weight: 'bold',
                align: 'end',
                flex: 7,
                wrap: true,
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              {
                type: 'text',
                text: 'ยืนยันโดย:',
                size: 'xs',
                color: '#64748B',
              },
              {
                type: 'text',
                text: order.confirmedBy || 'ผู้ดูแลระบบ',
                size: 'xs',
                color: '#1E293B',
                weight: 'bold',
                align: 'end',
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              {
                type: 'text',
                text: 'เวลายืนยัน:',
                size: 'xs',
                color: '#64748B',
              },
              {
                type: 'text',
                text: order.confirmedAt || new Date().toLocaleString('th-TH'),
                size: 'xs',
                color: '#1E293B',
                align: 'end',
              },
            ],
          },
          {
            type: 'separator',
            margin: 'md',
            color: '#E2E8F0',
          },
          {
            type: 'text',
            text: 'สถานะ: ยืนยันแล้ว กำลังจัดส่งเข้าคลังสินค้า',
            size: 'xs',
            color: '#059669',
            weight: 'bold',
            margin: 'md',
          },
        ],
      },
    },
  };
};

/**
 * Send reply message using LINE Messaging API replyToken (Instant chat response)
 * Automatically tries Purchase Order token and primary Channel Access Token
 */
export const replyLineMessage = async (
  replyToken: string,
  messages: any[],
  customToken?: string
): Promise<{ success: boolean; error?: string }> => {
  if (!replyToken) {
    return { success: false, error: 'replyToken หายไป' };
  }

  const candidateTokens = Array.from(
    new Set(
      [
        customToken,
        serverLineConfig.purchaseOrderChannelAccessToken,
        serverLineConfig.channelAccessToken,
        process.env.LINE_CHANNEL_ACCESS_TOKEN,
      ]
        .map(t => (t || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim())
        .filter(Boolean)
    )
  );

  if (candidateTokens.length === 0) {
    return { success: false, error: 'LINE Channel Access Token ยังไม่ได้กำหนดค่า' };
  }

  let lastError = '';
  for (const token of candidateTokens) {
    try {
      const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          replyToken,
          messages,
        }),
      });

      if (response.ok) {
        return { success: true };
      }

      const errorBody = await response.text();
      lastError = `LINE reply error ${response.status}: ${errorBody}`;
      console.warn('LINE reply API attempt warning:', response.status, errorBody);
    } catch (err: any) {
      lastError = err?.message || 'Network error';
      console.warn('Failed to reply to LINE:', lastError);
    }
  }

  return { success: false, error: lastError || 'Failed to reply to LINE' };
};

/**
 * Retrieve user profile from LINE (User display name, picture)
 */
export const getLineUserProfile = async (
  userId?: string,
  groupId?: string,
  customToken?: string
): Promise<{ displayName?: string; pictureUrl?: string; userId?: string } | null> => {
  if (!userId) return null;
  const candidateTokens = Array.from(
    new Set(
      [
        customToken,
        serverLineConfig.purchaseOrderChannelAccessToken,
        serverLineConfig.channelAccessToken,
        process.env.LINE_CHANNEL_ACCESS_TOKEN,
      ]
        .map(t => (t || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim())
        .filter(Boolean)
    )
  );

  for (const token of candidateTokens) {
    try {
      if (groupId) {
        try {
          const groupRes = await fetch(`https://api.line.me/v2/bot/group/${groupId}/member/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (groupRes.ok) {
            return await groupRes.json();
          }
        } catch (_) {}
      }

      const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not fetch LINE profile:', err);
    }
  }
  return null;
};

/**
 * Create LINE Flex Message for Stock Inquiry Results (ค้นหาสต็อก / ของหมด / ใกล้หมด / หมวดหมู่)
 */
export const createStockInquiryFlexMessage = (params: {
  title: string;
  subtitle: string;
  headerColor?: string;
  queryText: string;
  totalMatched: number;
  items: Array<{
    id: string;
    name: string;
    category?: string;
    qty: number;
    unit?: string;
    minStock?: number;
    location?: string;
    status?: string;
    ordered?: string;
  }>;
  baseUrl?: string;
}) => {
  const {
    title,
    subtitle,
    headerColor = '#0284C7',
    queryText,
    totalMatched,
    items,
    baseUrl,
  } = params;

  const displayItems = items.slice(0, 10);
  const isSingleItem = displayItems.length === 1;
  const nowStr = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });

  const itemRows: any[] = displayItems.map((it, idx) => {
    const qty = Number(it.qty) || 0;
    const min = Number(it.minStock) || 1;
    const unit = it.unit || 'ชิ้น';
    const isOut = qty <= 0 || it.status === 'out';
    const isLow = !isOut && (qty <= min || it.status === 'low');

    const statusBadgeText = isOut ? '🔴 หมดสต็อก' : isLow ? '🟡 ใกล้หมด' : '🟢 พร้อมใช้';
    const statusColor = isOut ? '#DC2626' : isLow ? '#D97706' : '#059669';
    const statusBg = isOut ? '#FEF2F2' : isLow ? '#FFFBEB' : '#ECFDF5';
    const statusBorder = isOut ? '#FECACA' : isLow ? '#FDE68A' : '#A7F3D0';
    const cardBorder = isOut ? '#FCA5A5' : isLow ? '#FCD34D' : '#CBD5E1';

    return {
      type: 'box',
      layout: 'vertical',
      paddingAll: '14px',
      backgroundColor: '#FFFFFF',
      borderWidth: '2px',
      borderColor: cardBorder,
      cornerRadius: '14px',
      margin: idx === 0 ? 'none' : 'md',
      contents: [
        // Row 1: Item ID on left + Status badge on right
        {
          type: 'box',
          layout: 'horizontal',
          alignItems: 'center',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#F1F5F9',
              cornerRadius: '6px',
              paddingAll: '4px',
              paddingStart: '8px',
              paddingEnd: '8px',
              flex: 0,
              contents: [
                {
                  type: 'text',
                  text: `รหัส: ${it.id}`,
                  size: 'xs',
                  weight: 'bold',
                  color: '#334155',
                },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [],
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: statusBg,
              borderWidth: '1px',
              borderColor: statusBorder,
              cornerRadius: '6px',
              paddingAll: '4px',
              paddingStart: '8px',
              paddingEnd: '8px',
              flex: 0,
              contents: [
                {
                  type: 'text',
                  text: statusBadgeText,
                  size: 'xs',
                  weight: 'bold',
                  color: statusColor,
                  align: 'center',
                },
              ],
            },
          ],
        },
        // Row 2: Part Name (Full width, large & bold, never truncated)
        {
          type: 'text',
          text: isSingleItem ? (it.name || it.id) : `${idx + 1}. ${it.name || it.id}`,
          weight: 'bold',
          size: isSingleItem ? 'xl' : 'lg',
          color: '#0F172A',
          margin: 'sm',
          wrap: true,
        },
        // Row 3: Category & Location
        {
          type: 'text',
          text: `หมวดหมู่: ${it.category || 'ทั่วไป'}  •  ที่เก็บ: ${it.location || 'Store FL.6'}`,
          size: 'xs',
          color: '#475569',
          margin: 'xs',
          wrap: true,
        },
        // Row 4: Prominent Quantity Box (Dedicated full-width highlight banner)
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          backgroundColor: statusBg,
          borderWidth: '1px',
          borderColor: statusBorder,
          cornerRadius: '10px',
          paddingAll: '12px',
          alignItems: 'center',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 4,
              contents: [
                {
                  type: 'text',
                  text: 'จำนวนคงเหลือ',
                  size: 'xs',
                  weight: 'bold',
                  color: '#1E293B',
                },
                {
                  type: 'text',
                  text: `(ขั้นต่ำ ${min} ${unit})`,
                  size: 'xxs',
                  color: '#64748B',
                },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 6,
              contents: [
                {
                  type: 'text',
                  text: `${qty.toLocaleString()} ${unit}`,
                  size: isSingleItem ? 'xxl' : 'xl',
                  weight: 'bold',
                  color: statusColor,
                  align: 'end',
                  wrap: true,
                },
              ],
            },
          ],
        },
        ...(it.ordered
          ? [
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'sm',
                backgroundColor: '#EFF6FF',
                cornerRadius: '8px',
                paddingAll: '8px',
                contents: [
                  {
                    type: 'text',
                    text: `🛒 สถานะสั่งซื้อ: ${it.ordered}`,
                    size: 'xs',
                    color: '#1D4ED8',
                    weight: 'bold',
                    wrap: true,
                  },
                ],
              },
            ]
          : []),
      ],
    };
  });

  const altSummary =
    displayItems.length > 0
      ? displayItems
          .slice(0, 5)
          .map(i => `• ${i.name} (${i.id}): คงเหลือ ${Number(i.qty) || 0} ${i.unit || 'ชิ้น'}`)
          .join('\n')
      : `ไม่พบรายการสำหรับ "${queryText}"`;

  return {
    type: 'flex',
    altText: `📦 ${title}: พบ ${totalMatched} รายการ\n${altSummary}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerColor,
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'ENG SMART STORE • FL.6',
                color: '#E0F2FE',
                size: 'xs',
                weight: 'bold',
                flex: 1,
              },
              {
                type: 'text',
                text: `อัปเดต ${nowStr}`,
                color: '#E0F2FE',
                size: 'xs',
                align: 'end',
              },
            ],
          },
          {
            type: 'text',
            text: title,
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
            margin: 'xs',
            wrap: true,
          },
          {
            type: 'text',
            text: subtitle,
            color: '#F0F9FF',
            size: 'xs',
            margin: 'xs',
            wrap: true,
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '14px',
        backgroundColor: '#F8FAFC',
        spacing: 'sm',
        contents: [
          ...(itemRows.length > 0
            ? itemRows
            : [
                {
                  type: 'box',
                  layout: 'vertical',
                  paddingAll: '16px',
                  backgroundColor: '#FFFFFF',
                  borderWidth: '1px',
                  borderColor: '#E2E8F0',
                  cornerRadius: '12px',
                  contents: [
                    {
                      type: 'text',
                      text: `ไม่พบรายการที่ตรงกับ "${queryText}"`,
                      size: 'md',
                      weight: 'bold',
                      color: '#334155',
                      align: 'center',
                      wrap: true,
                    },
                    {
                      type: 'text',
                      text: 'ลองพิมพ์ชื่ออะไหล่สั้นๆ เช่น "ท่อ PVC", "หลอดไฟ", "แอร์" หรือพิมพ์ "คำสั่ง" เพื่อดูวิธีใช้งาน',
                      size: 'xs',
                      color: '#64748B',
                      align: 'center',
                      margin: 'sm',
                      wrap: true,
                    },
                  ],
                },
              ]),
          ...(totalMatched > displayItems.length
            ? [
                {
                  type: 'text',
                  text: `* แสดง ${displayItems.length} รายการแรก จากทั้งหมด ${totalMatched} รายการ`,
                  size: 'xs',
                  weight: 'bold',
                  color: '#475569',
                  align: 'center',
                  margin: 'sm',
                },
              ]
            : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        backgroundColor: '#F8FAFC',
        spacing: 'xs',
        contents: [
          {
            type: 'text',
            text: '💡 พิมพ์ชื่ออะไหล่, "ของหมด", "ใกล้หมด", "หมวด <ชื่อ>" หรือ "สรุปสต็อก" เพื่อเช็คได้ทันที',
            size: 'xxs',
            color: '#64748B',
            align: 'center',
            wrap: true,
          },
          ...(baseUrl && baseUrl.startsWith('http')
            ? [
                {
                  type: 'button',
                  style: 'secondary',
                  height: 'sm',
                  margin: 'sm',
                  action: {
                    type: 'uri',
                    label: 'เปิดแอปคลังสินค้า Store FL.6',
                    uri: baseUrl,
                  },
                },
              ]
            : []),
        ],
      },
    },
  };
};

/**
 * Create LINE Flex Message for Warehouse Stock Summary ("สรุปสต็อก" / "ภาพรวม")
 */
export const createStockSummaryFlexMessage = (params: {
  totalItems: number;
  totalUnits: number;
  normalCount: number;
  lowCount: number;
  outCount: number;
  categories: Array<{ name: string; count: number }>;
  baseUrl?: string;
}) => {
  const { totalItems, totalUnits, normalCount, lowCount, outCount, categories, baseUrl } = params;
  const nowStr = new Date().toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });

  const catLines = categories.slice(0, 10).map(c => ({
    type: 'box',
    layout: 'horizontal',
    margin: 'xs',
    contents: [
      {
        type: 'text',
        text: `• หมวด${c.name}`,
        size: 'xs',
        color: '#334155',
        flex: 7,
      },
      {
        type: 'text',
        text: `${c.count} รายการ`,
        size: 'xs',
        weight: 'bold',
        color: '#0F172A',
        align: 'end',
        flex: 3,
      },
    ],
  }));

  return {
    type: 'flex',
    altText: `📊 สรุปสต็อก Store FL.6: ทั้งหมด ${totalItems} รายการ (ปกติ ${normalCount}, ใกล้หมด ${lowCount}, หมด ${outCount})`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E293B',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: `ENG SMART STORE • อัปเดต ${nowStr}`,
            color: '#94A3B8',
            size: 'xxs',
            weight: 'bold',
          },
          {
            type: 'text',
            text: '📊 สรุปภาพรวมสต็อกคลังสินค้า (Store FL.6)',
            color: '#FFFFFF',
            size: 'md',
            weight: 'bold',
            margin: 'xs',
            wrap: true,
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#F1F5F9',
                cornerRadius: '10px',
                paddingAll: '10px',
                flex: 1,
                contents: [
                  { type: 'text', text: 'รายการทั้งหมด', size: 'xxs', color: '#64748B', align: 'center' },
                  { type: 'text', text: `${totalItems}`, size: 'lg', weight: 'bold', color: '#0F172A', align: 'center' },
                  { type: 'text', text: `รวม ${totalUnits.toLocaleString()} ชิ้น`, size: 'xxs', color: '#475569', align: 'center' },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#ECFDF5',
                cornerRadius: '10px',
                paddingAll: '10px',
                flex: 1,
                contents: [
                  { type: 'text', text: 'สถานะปกติ', size: 'xxs', color: '#059669', align: 'center' },
                  { type: 'text', text: `${normalCount}`, size: 'lg', weight: 'bold', color: '#059669', align: 'center' },
                  { type: 'text', text: 'รายการ', size: 'xxs', color: '#059669', align: 'center' },
                ],
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FFFBEB',
                cornerRadius: '10px',
                paddingAll: '10px',
                flex: 1,
                contents: [
                  { type: 'text', text: 'ใกล้หมด (Low)', size: 'xxs', color: '#D97706', align: 'center' },
                  { type: 'text', text: `${lowCount}`, size: 'lg', weight: 'bold', color: '#D97706', align: 'center' },
                  { type: 'text', text: 'พิมพ์ "ใกล้หมด"', size: 'xxs', color: '#B45309', align: 'center' },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FEF2F2',
                cornerRadius: '10px',
                paddingAll: '10px',
                flex: 1,
                contents: [
                  { type: 'text', text: 'หมดสต็อก (Out)', size: 'xxs', color: '#DC2626', align: 'center' },
                  { type: 'text', text: `${outCount}`, size: 'lg', weight: 'bold', color: '#DC2626', align: 'center' },
                  { type: 'text', text: 'พิมพ์ "ของหมด"', size: 'xxs', color: '#B91C1C', align: 'center' },
                ],
              },
            ],
          },
          {
            type: 'separator',
            color: '#E2E8F0',
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'หมวดหมู่สินค้าในคลัง:',
                size: 'xs',
                weight: 'bold',
                color: '#475569',
              },
              ...catLines,
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        backgroundColor: '#F8FAFC',
        contents: [
          {
            type: 'text',
            text: 'พิมพ์ชื่ออะไหล่ เช่น "สต็อก ท่อ PVC" เพื่อเช็คจำนวนคงเหลือรายชิ้น',
            size: 'xxs',
            color: '#64748B',
            align: 'center',
            wrap: true,
          },
          ...(baseUrl && baseUrl.startsWith('http')
            ? [
                {
                  type: 'button',
                  style: 'primary',
                  color: '#2563EB',
                  height: 'sm',
                  margin: 'sm',
                  action: {
                    type: 'uri',
                    label: 'เปิดดูแดชบอร์ดในแอป',
                    uri: baseUrl,
                  },
                },
              ]
            : []),
        ],
      },
    },
  };
};


