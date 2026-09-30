require("dotenv").config();
const { connectMongo, mongoose, MONGODB_DB_NAME } = require("../config/mongo");
const { User, Task, UserTask, Completion, Visitor, Issue, ReviewCheck, Alert } = require("../models");
const bcrypt = require("bcryptjs");

const RAW_USERS = [
  { id: "m1", name: "Ops Manager", username: "manager", password: "Manager@123", role: "manager", location: "All centres", designation: "ops-head" },
  { id: "m2", name: "Mannat Jain", username: "mannat", password: "Mannat@123", role: "manager", location: "All centres", designation: "marketing-head" },
  { id: "m3", name: "Anil Purdhani", username: "anil", password: "Anil@123", role: "manager", location: "All centres", designation: "co-founder" },
  { id: "m-ravi", name: "Ravi Pawar", username: "ravi", password: "password123", role: "manager", location: "All centres", designation: "cluster-manager" },
  { id: "m-abhishek-g", name: "Abhishek Kumar", username: "abhishek.kumar", password: "password123", role: "manager", location: "All centres", designation: "cluster-manager" },
  { id: "e1", name: "Anubhav", username: "anubhav", password: "password123", role: "employee", designation: "cm", location: "E-44/3, Pocket D, Okhla Phase II", manager_id: "m-ravi" },
  { id: "e2", name: "Arpit Tanwar", username: "arpit", password: "password123", role: "employee", designation: "cm", location: "Okhla Phase 3", manager_id: "m-ravi" },
  { id: "e5", name: "Kamal Khanna", username: "kamal", password: "password123", role: "employee", designation: "cm", location: "Noida Sector 126", manager_id: "m-abhishek-g" },
  { id: "e6", name: "Abhishek Dalal", username: "abhishek", password: "password123", role: "employee", designation: "cm", location: "Udyog Vihar Phase 4", manager_id: "m-ravi" },
  { id: "e10", name: "Akanksha Mohanty", username: "akanksha", password: "password123", role: "employee", designation: "cm", location: "ECE House, Connaught Place", manager_id: "m-ravi" },
  { id: "e12", name: "Kartik Sharma", username: "kartik", password: "password123", role: "employee", designation: "cm", location: "Mohan Cooperative", manager_id: "m-abhishek-g" },
  { id: "e3", name: "Amit Kumar", username: "amit", password: "password123", role: "employee", designation: "supervisor", location: "Okhla Phase 3", supervisor_id: "e2" },
  { id: "e4", name: "Mukund Raj Choudhary", username: "mukund", password: "password123", role: "employee", designation: "supervisor", location: "Okhla Phase 3", supervisor_id: "e2" },
  { id: "e9", name: "Harish Naagar", username: "harish", password: "password123", role: "employee", designation: "supervisor", location: "151, Okhla Phase 3", supervisor_id: "e2" },
  { id: "e11", name: "Mohammad Sameer", username: "sameer.ece", password: "password123", role: "employee", designation: "supervisor", location: "Nuvama, Connaught Place", supervisor_id: "e10" },
  { id: "e-vivek", name: "Vivek Bhagwana", username: "vivek", password: "password123", role: "employee", designation: "supervisor", location: "ECE House, Connaught Place", supervisor_id: "e10" },
  { id: "e13", name: "Akash Kumar", username: "akash", password: "password123", role: "employee", designation: "supervisor", location: "E-44/3, Pocket D, Okhla Phase II", supervisor_id: "e1" },
  { id: "e14", name: "Saroj Kumar", username: "saroj", password: "password123", role: "employee", designation: "supervisor", location: "E-40/7, Okhla Phase II", supervisor_id: "e1" },
  { id: "e-satendra", name: "Satendra Singh", username: "satendra", password: "password123", role: "employee", designation: "supervisor", location: "Udyog Vihar Phase 4", supervisor_id: "e6" },
  { id: "e8", name: "Sameer Kumar", username: "sameer", password: "password123", role: "employee", designation: "supervisor", location: "Emaar Capital", supervisor_id: "e6" },
  { id: "e-deepak", name: "Deepak", username: "deepak.126", password: "password123", role: "employee", designation: "supervisor", location: "Noida Sector 126", supervisor_id: "e5" },
  { id: "e-arun", name: "Arun Bhardwaj", username: "arun", password: "password123", role: "employee", designation: "supervisor", location: "Mohan Cooperative", supervisor_id: "e12" }
];

async function seedMongo() {
  await connectMongo();
  console.log(`[SEED] Initializing seed for database: "${MONGODB_DB_NAME}"...`);

  // 1. Seed Users
  let userCount = 0;
  for (const u of RAW_USERS) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    await User.findOneAndUpdate(
      { id: u.id },
      {
        id: u.id,
        username: u.username.toLowerCase(),
        password: hashedPassword,
        name: u.name,
        role: u.role,
        designation: u.designation,
        location: u.location,
        supervisor_id: u.supervisor_id || null,
        manager_id: u.manager_id || null,
        is_active: true,
      },
      { upsert: true, new: true }
    );
    userCount++;
  }
  console.log(`[SEED] Successfully seeded ${userCount} users into "${MONGODB_DB_NAME}.users"`);

  // Verify collections in onward_app
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(`[SEED] Active collections in "${MONGODB_DB_NAME}":`, collections.map(c => c.name));

  await mongoose.disconnect();
  console.log("[SEED] MongoDB Seeding Completed!");
}

seedMongo().catch(err => {
  console.error("[SEED ERROR]", err);
  process.exit(1);
});
