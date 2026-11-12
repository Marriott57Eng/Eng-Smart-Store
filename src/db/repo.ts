import { db } from './index.ts';
import { inventory, requisitions, purchaseOrders, users, appSettings, pushSubscriptions } from './schema.ts';
import { eq, desc } from 'drizzle-orm';
import type { InventoryItem, RequisitionRecord, PurchaseOrder, User } from '../types.ts';

// 1. Inventory Items
export async function getInventoryFromDb(): Promise<InventoryItem[]> {
  try {
    const rows = await db.select().from(inventory);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      unit: r.unit,
      qty: Number(r.qty) || 0,
      minStock: Number(r.minStock) || 1,
      location: r.location || '',
      note: r.note || '',
      ordered: r.ordered || '',
      orderedDate: r.orderedDate || '',
      status: (r.status as 'normal' | 'low' | 'out') || 'normal',
      outOfStockDate: r.outOfStockDate || undefined,
      lastUpdated: r.lastUpdated || undefined,
    }));
  } catch (error) {
    console.error('getInventoryFromDb error:', error);
    throw new Error('Failed to fetch inventory from SQL database', { cause: error });
  }
}

export async function upsertInventoryItemToDb(item: InventoryItem): Promise<void> {
  try {
    await db.insert(inventory)
      .values({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        qty: Number(item.qty) || 0,
        minStock: Number(item.minStock) || 1,
        location: item.location || '',
        note: item.note || '',
        ordered: item.ordered || '',
        orderedDate: item.orderedDate || '',
        status: item.status || 'normal',
        outOfStockDate: item.outOfStockDate || null,
        lastUpdated: item.lastUpdated || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: inventory.id,
        set: {
          name: item.name,
          category: item.category,
          unit: item.unit,
          qty: Number(item.qty) || 0,
          minStock: Number(item.minStock) || 1,
          location: item.location || '',
          note: item.note || '',
          ordered: item.ordered || '',
          orderedDate: item.orderedDate || '',
          status: item.status || 'normal',
          outOfStockDate: item.outOfStockDate || null,
          lastUpdated: item.lastUpdated || new Date().toISOString(),
        },
      });
  } catch (error) {
    console.error('upsertInventoryItemToDb error:', error);
    throw new Error('Failed to save inventory item to SQL database', { cause: error });
  }
}

// 2. Requisitions
export async function getRequisitionsFromDb(): Promise<RequisitionRecord[]> {
  try {
    const rows = await db.select().from(requisitions).orderBy(desc(requisitions.isoDate));
    return rows.map((r) => ({
      id: r.id,
      type: (r.type as 'in' | 'out') || 'out',
      itemId: r.itemId,
      itemName: r.itemName,
      category: r.category || '',
      qty: Number(r.qty) || 0,
      unit: r.unit,
      requestedBy: r.requestedBy,
      purpose: r.purpose || '',
      timestamp: r.timestamp,
      isoDate: r.isoDate,
      note: r.note || '',
    }));
  } catch (error) {
    console.error('getRequisitionsFromDb error:', error);
    throw new Error('Failed to fetch requisitions from SQL database', { cause: error });
  }
}

export async function insertRequisitionToDb(record: RequisitionRecord): Promise<void> {
  try {
    await db.insert(requisitions)
      .values({
        id: record.id,
        type: record.type || 'out',
        itemId: record.itemId,
        itemName: record.itemName,
        category: record.category || '',
        qty: Number(record.qty) || 0,
        unit: record.unit,
        requestedBy: record.requestedBy,
        purpose: record.purpose || '',
        timestamp: record.timestamp,
        isoDate: record.isoDate,
        note: record.note || '',
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('insertRequisitionToDb error:', error);
    throw new Error('Failed to insert requisition to SQL database', { cause: error });
  }
}

// 3. Purchase Orders
export async function getPurchaseOrdersFromDb(): Promise<PurchaseOrder[]> {
  try {
    const rows = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.isoDate));
    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      itemName: r.itemName,
      category: r.category || '',
      qty: Number(r.qty) || 0,
      unit: r.unit,
      currentQty: r.currentQty !== null ? Number(r.currentQty) : undefined,
      minStock: r.minStock !== null ? Number(r.minStock) : undefined,
      location: r.location || '',
      requestedBy: r.requestedBy,
      brand: r.brand || '',
      model: r.model || '',
      supplier: r.supplier || '',
      note: r.note || '',
      urgency: (r.urgency as 'normal' | 'urgent' | 'critical') || 'normal',
      status: (r.status as 'pending' | 'confirmed' | 'received' | 'cancelled') || 'pending',
      createdAt: r.createdAt,
      isoDate: r.isoDate,
      confirmedAt: r.confirmedAt || undefined,
      confirmedBy: r.confirmedBy || undefined,
      receivedAt: r.receivedAt || undefined,
      receivedBy: r.receivedBy || undefined,
      confirmationToken: r.confirmationToken || null,
      confirmationTokenUsed: Boolean(r.confirmationTokenUsed),
      isLocked: Boolean(r.isLocked),
    }));
  } catch (error) {
    console.error('getPurchaseOrdersFromDb error:', error);
    throw new Error('Failed to fetch purchase orders from SQL database', { cause: error });
  }
}

export async function upsertPurchaseOrderToDb(po: PurchaseOrder): Promise<void> {
  try {
    await db.insert(purchaseOrders)
      .values({
        id: po.id,
        itemId: po.itemId,
        itemName: po.itemName,
        category: po.category || '',
        qty: Number(po.qty) || 0,
        unit: po.unit,
        currentQty: po.currentQty !== undefined ? Number(po.currentQty) : null,
        minStock: po.minStock !== undefined ? Number(po.minStock) : null,
        location: po.location || '',
        requestedBy: po.requestedBy,
        brand: po.brand || '',
        model: po.model || '',
        supplier: po.supplier || '',
        note: po.note || '',
        urgency: po.urgency || 'normal',
        status: po.status || 'pending',
        createdAt: po.createdAt,
        isoDate: po.isoDate,
        confirmedAt: po.confirmedAt || null,
        confirmedBy: po.confirmedBy || null,
        receivedAt: po.receivedAt || null,
        receivedBy: po.receivedBy || null,
        confirmationToken: po.confirmationToken || null,
        confirmationTokenUsed: Boolean(po.confirmationTokenUsed),
        isLocked: Boolean(po.isLocked),
      })
      .onConflictDoUpdate({
        target: purchaseOrders.id,
        set: {
          itemName: po.itemName,
          category: po.category || '',
          qty: Number(po.qty) || 0,
          unit: po.unit,
          currentQty: po.currentQty !== undefined ? Number(po.currentQty) : null,
          minStock: po.minStock !== undefined ? Number(po.minStock) : null,
          location: po.location || '',
          requestedBy: po.requestedBy,
          brand: po.brand || '',
          model: po.model || '',
          supplier: po.supplier || '',
          note: po.note || '',
          urgency: po.urgency || 'normal',
          status: po.status || 'pending',
          confirmedAt: po.confirmedAt || null,
          confirmedBy: po.confirmedBy || null,
          receivedAt: po.receivedAt || null,
          receivedBy: po.receivedBy || null,
          confirmationToken: po.confirmationToken || null,
          confirmationTokenUsed: Boolean(po.confirmationTokenUsed),
          isLocked: Boolean(po.isLocked),
        },
      });
  } catch (error) {
    console.error('upsertPurchaseOrderToDb error:', error);
    throw new Error('Failed to upsert purchase order to SQL database', { cause: error });
  }
}

// 4. Users
export async function getUsersFromDb(): Promise<User[]> {
  try {
    const rows = await db.select().from(users);
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      password: r.password || '',
      name: r.name,
      nickname: r.nickname || '',
      role: (r.role as 'admin' | 'user') || 'user',
      createdAt: r.createdAt || undefined,
      sessionToken: r.sessionToken || undefined,
      activeDeviceId: r.activeDeviceId || undefined,
      lastActiveAt: r.lastActiveAt ? Number(r.lastActiveAt) : undefined,
    }));
  } catch (error) {
    console.error('getUsersFromDb error:', error);
    throw new Error('Failed to fetch users from SQL database', { cause: error });
  }
}

export async function upsertUserToDb(user: User): Promise<void> {
  try {
    await db.insert(users)
      .values({
        id: user.id,
        username: user.username,
        password: user.password || null,
        name: user.name,
        nickname: user.nickname || '',
        role: user.role || 'user',
        createdAt: user.createdAt || new Date().toISOString(),
        sessionToken: user.sessionToken || null,
        activeDeviceId: user.activeDeviceId || null,
        lastActiveAt: user.lastActiveAt || null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: user.username,
          password: user.password !== undefined ? user.password : null,
          name: user.name,
          nickname: user.nickname || '',
          role: user.role || 'user',
          sessionToken: user.sessionToken || null,
          activeDeviceId: user.activeDeviceId || null,
          lastActiveAt: user.lastActiveAt || null,
        },
      });
  } catch (error) {
    console.error('upsertUserToDb error:', error);
    throw new Error('Failed to upsert user to SQL database', { cause: error });
  }
}

// 5. App Settings
export async function getSettingFromDb<T>(key: string): Promise<T | null> {
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, key));
    if (rows.length === 0) return null;
    return JSON.parse(rows[0].value) as T;
  } catch (error) {
    console.error(`getSettingFromDb(${key}) error:`, error);
    return null;
  }
}

export async function saveSettingToDb(key: string, value: any, updatedBy = 'system'): Promise<void> {
  try {
    const payload = JSON.stringify(value);
    await db.insert(appSettings)
      .values({
        key,
        value: payload,
        updatedAt: new Date().toISOString(),
        updatedBy,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: payload,
          updatedAt: new Date().toISOString(),
          updatedBy,
        },
      });
  } catch (error) {
    console.error(`saveSettingToDb(${key}) error:`, error);
    throw new Error(`Failed to save setting ${key} to SQL database`, { cause: error });
  }
}
