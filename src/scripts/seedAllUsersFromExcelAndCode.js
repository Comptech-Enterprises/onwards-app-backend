require("dotenv").config();
const { connectMongo, mongoose, MONGODB_DB_NAME } = require("../config/mongo");
const { User, Task, UserTask } = require("../models");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const SEED_USERS_EXTRA = [
  // Leadership & Heads
  { id: "m-suvrat", name: "Suvrat Jain", username: "suvrat", password: "Suvrat@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0001", designation: "ceo" },
  { id: "m3", name: "Anil Purdhani", username: "anil", password: "Anil@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0034", designation: "co-founder" },
  { id: "m2", name: "Mannat Jain", username: "mannat", password: "Mannat@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0003", designation: "marketing-head" },
  { id: "m-priyanka-j", name: "Priyanka Jain", username: "priyanka.jain", password: "Priyanka@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0002", designation: "project-design-head" },
  { id: "m-ipshita", name: "Ipshita B. Roy", username: "ipshita", password: "Ipshita@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0029", designation: "hr-manager" },
  { id: "m4", name: "Vineeta Sanduja", username: "vineeta", password: "Vineeta@123", role: "manager", location: "All centres", phone: "8586007404", employeeCode: "OWEMP-0018", designation: "business-ops-head" },

  // Cluster Managers
  { id: "m-ravi", name: "Ravi Pawar", username: "ravi", password: "Ravi@123", role: "manager", location: "All centres", phone: "9220407270", employeeCode: "OWEMP-0004", designation: "cluster-manager" },
  { id: "m-abhishek-g", name: "Abhishek Kumar", username: "abhishek.kumar", password: "Abhishek@123", role: "manager", location: "All centres", phone: "9220407279", employeeCode: "OWEMP-0013", designation: "cluster-manager" },

  // IT & Maintenance Managers & Executives
  { id: "m-gurdeep", name: "Gurdeep Kumar", username: "gurdeep", password: "Gurdeep@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0005", designation: "it-manager" },
  { id: "e-manish", name: "Manish Chaudhary", username: "manish", password: "Manish@123", role: "employee", designation: "it-executive", supervisorId: "m-gurdeep", location: "All centres", employeeCode: "OWEMP-0031" },
  { id: "m-sarshti", name: "Sarshti Singh", username: "sarshti", password: "Sarshti@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0015", designation: "sales-manager" },
  { id: "e-shreya", name: "Shreya Saran", username: "shreya", password: "Shreya@123", role: "employee", designation: "lead-inside-sales", supervisorId: "m-sarshti", location: "All centres", employeeCode: "OWEMP-0035" },
  { id: "m-sandeep", name: "Sandeep Mishra", username: "sandeep", password: "Sandeep@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0019", designation: "ops-maintenance" },
  { id: "e-devendra", name: "Devendra Kumar Mehta", username: "devendra", password: "Devendra@123", role: "employee", designation: "maintenance", supervisorId: "m-sandeep", location: "All centres", employeeCode: "OWEMP-0024" },

  // Centre Managers
  { id: "e2", name: "Arpit Tanwar", username: "arpit", password: "Arpit@123", role: "employee", designation: "cm", location: "Okhla Phase 3", employeeCode: "OWEMP-0007", phone: "9717289816", managerId: "m-ravi" },
  { id: "e6", name: "Abhishek Dalal", username: "abhishek", password: "Abhishek@123", role: "employee", designation: "cm", location: "Udyog Vihar Phase 4", employeeCode: "OWEMP-0012", phone: "9220407273", managerId: "m-ravi" },
  { id: "e1", name: "Anubhav", username: "anubhav", password: "Anubhav@123", role: "employee", designation: "cm", location: "E-44/3, Pocket D, Okhla Phase II", employeeCode: "OWEMP-0022", phone: "8527445545", managerId: "m-ravi" },
  { id: "e10", name: "Akanksha Mohanty", username: "akanksha", password: "Akanksha@123", role: "employee", designation: "cm", location: "ECE House, Connaught Place", employeeCode: "OWEMP-0032", phone: "8260998500", managerId: "m-ravi" },
  { id: "e5", name: "Kamal Khanna", username: "kamal", password: "Kamal@123", role: "employee", designation: "cm", location: "Noida Sector 126", employeeCode: "OWEMP-0023", phone: "7206605207", managerId: "m-abhishek-g" },
  { id: "e12", name: "Kartik Sharma", username: "kartik", password: "Kartik@123", role: "employee", designation: "cm", location: "Mohan Cooperative", employeeCode: "OWEMP-0038", managerId: "m-abhishek-g" },

  // Facility Supervisors & Staff
  { id: "e4", name: "Mukund Raj Choudhary", username: "mukund", password: "Mukund@123", role: "employee", designation: "supervisor", supervisorId: "e2", location: "Okhla Phase 3", employeeCode: "OWEMP-0010", phone: "9990325738" },
  { id: "e9", name: "Harish Naagar", username: "harish", password: "Harish@123", role: "employee", designation: "supervisor", supervisorId: "e2", location: "151, Okhla Phase 3", employeeCode: "OWEMP-0030", phone: "8130293530" },
  { id: "e3", name: "Amit Kumar", username: "amit", password: "Amit@123", role: "employee", designation: "supervisor", supervisorId: "e2", location: "Okhla Phase 3", employeeCode: "OWEMP-0016", phone: "9210905185" },
  { id: "e-satendra", name: "Satendra Singh", username: "satendra", password: "Satendra@123", role: "employee", designation: "supervisor", supervisorId: "e6", location: "Udyog Vihar Phase 4", employeeCode: "OWEMP-0041", phone: "8506912081" },
  { id: "e8", name: "Sameer Kumar", username: "sameer", password: "Sameer@123", role: "employee", designation: "supervisor", supervisorId: "e6", location: "Emaar Capital", employeeCode: "OWEMP-0021", phone: "7042933051" },
  { id: "e14", name: "Saroj Kumar", username: "saroj", password: "Saroj@123", role: "employee", designation: "supervisor", supervisorId: "e1", location: "E-40/7, Okhla Phase II", employeeCode: "OWEMP-0009" },
  { id: "e13", name: "Akash Kumar", username: "akash", password: "Akash@123", role: "employee", designation: "supervisor", supervisorId: "e1", location: "E-44/3, Pocket D, Okhla Phase II", employeeCode: "OWEMP-0040", phone: "9953313194" },
  { id: "e11", name: "Mohammad Sameer", username: "sameer.ece", password: "Sameer@123", role: "employee", designation: "supervisor", supervisorId: "e10", location: "Nuvama, Connaught Place", employeeCode: "OWEMP-0033", phone: "9711478718" },
  { id: "e-vivek", name: "Vivek Bhagwana", username: "vivek", password: "Vivek@123", role: "employee", designation: "supervisor", supervisorId: "e10", location: "ECE House, Connaught Place", phone: "8700124331" },
  { id: "e-vikas", name: "Vikas", username: "vikas", password: "Vikas@123", role: "employee", designation: "supervisor", supervisorId: "m-abhishek-g", location: "All centres", employeeCode: "OWEMP-0008" },
  { id: "e-dileep", name: "Dileep Kumar Prajapat", username: "dileep", password: "Dileep@123", role: "employee", designation: "facility-manager-tech", supervisorId: "m-abhishek-g", location: "All centres", employeeCode: "OWEMP-0028" },
  { id: "e-deepak", name: "Deepak", username: "deepak.126", password: "Deepak@123", role: "employee", designation: "supervisor", supervisorId: "e5", location: "Noida Sector 126", employeeCode: "OWEMP-0042", phone: "9582236165" },
  { id: "e-arun", name: "Arun Bhardwaj", username: "arun", password: "Arun@123", role: "employee", designation: "supervisor", supervisorId: "e12", location: "Mohan Cooperative" },

  // Additional Staff
  { id: "e-shiva", name: "Shiva Bhati", username: "shiva", password: "Shiva@123", role: "employee", designation: "sr-facility-executive", location: "All centres" },
  { id: "e-priyanka-k", name: "Priyanka Kashyap", username: "priyanka.k", password: "Priyanka@123", role: "employee", designation: "front-desk-admin", employeeCode: "OWEMP-0025", location: "All centres" },
  { id: "e-shyam", name: "Shyam Sundar", username: "shyam", password: "Shyam@123", role: "employee", designation: "helpdesk-executive", employeeCode: "OWEMP-0026", location: "All centres" },
];

async function seedAllUsers() {
  await connectMongo();
  console.log(`[SEED] Seeding all users into "${MONGODB_DB_NAME}"...`);

  // Load excel users if available
  let excelUsers = [];
  const jsonPath = path.join(__dirname, "../../all_excel_users.json");
  if (fs.existsSync(jsonPath)) {
    excelUsers = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  }

  // Combine and map
  const userMap = new Map();

  for (const u of SEED_USERS_EXTRA) {
    userMap.set(u.username.toLowerCase(), u);
  }

  for (const eu of excelUsers) {
    const uname = (eu["Username"] || "").trim().toLowerCase();
    if (!uname) continue;
    const existing = userMap.get(uname) || {};
    userMap.set(uname, {
      id: existing.id || `u-${uname}`,
      name: eu["Name"] || existing.name,
      username: uname,
      password: eu["Password"] || existing.password || `${eu["Name"].split(" ")[0]}@123`,
      role: (eu["Role"] || existing.role || "employee").toLowerCase(),
      designation: eu["Designation"] || existing.designation,
      employeeCode: (eu["Employee Code"] && eu["Employee Code"] !== "—") ? eu["Employee Code"] : existing.employeeCode,
      location: existing.location || "All centres",
      phone: existing.phone,
      supervisorId: existing.supervisorId,
      managerId: existing.managerId,
    });
  }

  console.log(`[SEED] Total unique users to seed: ${userMap.size}`);

  const allTasks = await Task.find({});
  const allTaskIds = allTasks.map(t => t.id);
  console.log(`[SEED] Found ${allTaskIds.length} tasks in DB.`);

  let insertedCount = 0;
  for (const [uname, u] of userMap.entries()) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    const savedUser = await User.findOneAndUpdate(
      { username: uname },
      {
        id: u.id,
        name: u.name,
        username: uname,
        password: hashedPassword,
        role: u.role,
        designation: u.designation || null,
        location: u.location || "All centres",
        employee_code: u.employeeCode || null,
        phone: u.phone || null,
        supervisor_id: u.supervisorId || null,
        manager_id: u.managerId || null,
        is_active: true,
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (u.role === "employee") {
      for (const taskId of allTaskIds) {
        await UserTask.findOneAndUpdate(
          { userId: savedUser.id, taskId: taskId },
          { userId: savedUser.id, taskId: taskId },
          { upsert: true, returnDocument: 'after' }
        );
      }
    }
    insertedCount++;
  }

  const finalUserCount = await User.countDocuments();
  const finalUtCount = await UserTask.countDocuments();
  console.log(`[SEED] Finished! Total Users in DB: ${finalUserCount}, Total User-Task Mappings: ${finalUtCount}`);

  await mongoose.disconnect();
}

seedAllUsers().catch(err => {
  console.error("[SEED ERROR]", err);
  process.exit(1);
});
