#!/usr/bin/env ts-node
/**
 * Apply migration 032: Add autohome_selector_warning column
 * 
 * Usage:
 *   npx ts-node scripts/apply-migration-032.ts
 */

import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  console.log('🚀 Applying migration 032: Add autohome_selector_warning column...');
  
  const conn = MySQLConnectionManager.getInstance();
  
  try {
    // Read migration file
    const migrationPath = join(__dirname, '../src/db/migrations/032_add_autohome_selector_warning.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('');
    
    // Execute migration
    await conn.execute(migrationSQL);
    
    console.log('✅ Migration 032 applied successfully!');
    console.log('');
    console.log('📋 Changes:');
    console.log('   - Added autohome_selector_warning column to network_post_config table');
    console.log('   - This column stores warning messages when autohome selector fails');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await conn.close();
  }
}

// Run migration
applyMigration().catch(console.error);
