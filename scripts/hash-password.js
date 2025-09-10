#!/usr/bin/env node

// Usage: node scripts/hash-password.js "your-password"
// Or run interactively: node scripts/hash-password.js

import bcrypt from "bcryptjs";
import readline from "readline";

async function hashPassword(password) {
  const hash = await bcrypt.hash(password, 12);
  return hash;
}

async function main() {
  const password = process.argv[2];
  
  if (password) {
    // Command line argument provided
    const hash = await hashPassword(password);
    console.log("\nPassword hash (paste into password_hash column):");
    console.log(hash);
    console.log("\nSQL to insert user:");
    console.log(`INSERT INTO public.passwords (username, password_hash) VALUES ('your-username', '${hash}');`);
  } else {
    // Interactive mode
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question("Enter password to hash: ", async (input) => {
      const hash = await hashPassword(input);
      console.log("\nPassword hash (paste into password_hash column):");
      console.log(hash);
      console.log("\nSQL to insert user:");
      console.log(`INSERT INTO public.passwords (username, password_hash) VALUES ('your-username', '${hash}');`);
      rl.close();
    });
  }
}

main().catch(console.error);