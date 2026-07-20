import fs from 'fs';
import path from 'path';

const PERMISSIONS_FILE = path.join(__dirname, '../../data/admin_permissions.json');

interface PermissionsData {
  supportCustomerAccess: string[]; // List of Admin IDs
}

class AdminPermissionsService {
  private data: PermissionsData = { supportCustomerAccess: [] };

  constructor() {
    this.ensureDataDir();
    this.load();
  }

  private ensureDataDir() {
    const dataDir = path.dirname(PERMISSIONS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(PERMISSIONS_FILE)) {
      this.save();
    }
  }

  private load() {
    try {
      if (fs.existsSync(PERMISSIONS_FILE)) {
        const content = fs.readFileSync(PERMISSIONS_FILE, 'utf-8');
        this.data = JSON.parse(content);
      }
    } catch (err) {
      console.error('Failed to load admin permissions:', err);
    }
  }

  private save() {
    try {
      fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('Failed to save admin permissions:', err);
    }
  }

  hasCustomerAccess(adminId: string): boolean {
    return this.data.supportCustomerAccess.includes(adminId);
  }

  toggleCustomerAccess(adminId: string): boolean {
    console.log(`Toggling customer access for admin: ${adminId}`);
    const index = this.data.supportCustomerAccess.indexOf(adminId);
    let enabled = false;
    if (index === -1) {
      this.data.supportCustomerAccess.push(adminId);
      enabled = true;
    } else {
      this.data.supportCustomerAccess.splice(index, 1);
      enabled = false;
    }
    this.save();
    console.log(`Access toggled to: ${enabled}`);
    return enabled;
  }


  getAllAllowedSupportIds(): string[] {
    return this.data.supportCustomerAccess;
  }
}

export const adminPermissionsService = new AdminPermissionsService();
