require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PutCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("./db");

const USERS = [
  // Leadership
  { id: "m-suvrat", name: "Suvrat Jain", username: "suvrat", password: "Suvrat@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0001", designation: "ceo" },
  { id: "m3", name: "Anil Purdhani", username: "anil", password: "Anil@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0034", designation: "co-founder" },
  { id: "m2", name: "Mannat Jain", username: "mannat", password: "Mannat@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0003", designation: "marketing-head" },
  { id: "m-priyanka-j", name: "Priyanka Jain", username: "priyanka.jain", password: "Priyanka@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0002", designation: "project-design-head" },
  { id: "m-ipshita", name: "Ipshita B. Roy", username: "ipshita", password: "Ipshita@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0029", designation: "hr-manager" },

  // Cluster Managers
  { id: "m-ravi", name: "Ravi Pawar", username: "ravi", password: "Ravi@123", role: "manager", location: "All centres", phone: "9220407270", employeeCode: "OWEMP-0004", designation: "cluster-manager" },
  { id: "m-abhishek-g", name: "Abhishek Kumar", username: "abhishek.kumar", password: "Abhishek@123", role: "manager", location: "All centres", phone: "9220407279", employeeCode: "OWEMP-0013", designation: "cluster-manager" },

  // IT
  { id: "m-gurdeep", name: "Gurdeep Kumar", username: "gurdeep", password: "Gurdeep@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0005", designation: "it-manager" },
  { id: "e-manish", name: "Manish Chaudhary", username: "manish", password: "Manish@123", role: "employee", designation: "it-executive", supervisorId: "m-gurdeep", location: "All centres", employeeCode: "OWEMP-0031" },

  // Sales
  { id: "m-sarshti", name: "Sarshti Singh", username: "sarshti", password: "Sarshti@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0015", designation: "sales-manager" },
  { id: "e-shreya", name: "Shreya Saran", username: "shreya", password: "Shreya@123", role: "employee", designation: "lead-inside-sales", supervisorId: "m-sarshti", location: "All centres", employeeCode: "OWEMP-0035" },

  // Business Operations
  { id: "m4", name: "Vineeta Sanduja", username: "vineeta", password: "Vineeta@123", role: "manager", location: "All centres", phone: "8586007404", employeeCode: "OWEMP-0018", designation: "business-ops-head" },

  // Operational Maintenance
  { id: "m-sandeep", name: "Sandeep Mishra", username: "sandeep", password: "Sandeep@123", role: "manager", location: "All centres", employeeCode: "OWEMP-0019", designation: "ops-maintenance" },
  { id: "e-devendra", name: "Devendra Kumar Mehta", username: "devendra", password: "Devendra@123", role: "employee", designation: "maintenance", supervisorId: "m-sandeep", location: "All centres", employeeCode: "OWEMP-0024" },

  // Centre Managers — under Ravi Pawar
  { id: "e2", name: "Arpit Tanwar", username: "arpit", password: "Arpit@123", role: "employee", designation: "cm", location: "Okhla Phase 3", employeeCode: "OWEMP-0007", phone: "9717289816", managerId: "m-ravi" },
  { id: "e6", name: "Abhishek Dalal", username: "abhishek", password: "Abhishek@123", role: "employee", designation: "cm", location: "Udyog Vihar Phase 4", employeeCode: "OWEMP-0012", phone: "9220407273", managerId: "m-ravi" },
  { id: "e1", name: "Anubhav", username: "anubhav", password: "Anubhav@123", role: "employee", designation: "cm", location: "Okhla Phase 2", employeeCode: "OWEMP-0022", phone: "8527445545", managerId: "m-ravi" },
  { id: "e10", name: "Akanksha Mohanty", username: "akanksha", password: "Akanksha@123", role: "employee", designation: "cm", location: "ECE House, Connaught Place", employeeCode: "OWEMP-0032", phone: "8260998500", managerId: "m-ravi" },

  // Centre Managers — under Abhishek Kumar
  { id: "e5", name: "Kamal Khanna", username: "kamal", password: "Kamal@123", role: "employee", designation: "cm", location: "Noida Sector 126", employeeCode: "OWEMP-0023", phone: "7206605207", managerId: "m-abhishek-g" },
  { id: "e12", name: "Kartik Sharma", username: "kartik", password: "Kartik@123", role: "employee", designation: "cm", location: "Mohan Cooperative", employeeCode: "OWEMP-0038", managerId: "m-abhishek-g" },

  // Facility Supervisors — under Arpit Tanwar
  { id: "e4", name: "Mukund Raj Choudhary", username: "mukund", password: "Mukund@123", role: "employee", designation: "supervisor", supervisorId: "e2", location: "Okhla Phase 3", employeeCode: "OWEMP-0010", phone: "9990325738" },
  { id: "e9", name: "Harish Naagar", username: "harish", password: "Harish@123", role: "employee", designation: "supervisor", supervisorId: "e2", location: "151, Okhla Phase 3", employeeCode: "OWEMP-0030", phone: "8130293530" },
  { id: "e3", name: "Amit Kumar", username: "amit", password: "Amit@123", role: "employee", designation: "supervisor", supervisorId: "e2", location: "Okhla Phase 3", employeeCode: "OWEMP-0016", phone: "9210905185" },

  // Facility Supervisors — under Abhishek Dalal
  { id: "e8", name: "Sameer Kumar", username: "sameer", password: "Sameer@123", role: "employee", designation: "supervisor", supervisorId: "e6", location: "Emaar Capital", employeeCode: "OWEMP-0021", phone: "7042933051" },

  // Facility Supervisors — under Anubhav
  { id: "e14", name: "Saroj Kumar", username: "saroj", password: "Saroj@123", role: "employee", designation: "supervisor", supervisorId: "e1", location: "Okhla Phase 2", employeeCode: "OWEMP-0009" },
  { id: "e13", name: "Akash Kumar", username: "akash", password: "Akash@123", role: "employee", designation: "supervisor", supervisorId: "e1", location: "Okhla Phase 2", employeeCode: "OWEMP-0040", phone: "9953313194" },

  // Facility Supervisors — under Akanksha Mohanty
  { id: "e11", name: "Mohammad Sameer", username: "sameer.ece", password: "Sameer@123", role: "employee", designation: "supervisor", supervisorId: "e10", location: "ECE House, Connaught Place", employeeCode: "OWEMP-0033", phone: "9711478718" },

  // Under Abhishek Kumar cluster
  { id: "e-vikas", name: "Vikas", username: "vikas", password: "Vikas@123", role: "employee", designation: "supervisor", supervisorId: "m-abhishek-g", location: "All centres", employeeCode: "OWEMP-0008" },
  { id: "e-dileep", name: "Dileep Kumar Prajapat", username: "dileep", password: "Dileep@123", role: "employee", designation: "facility-manager-tech", supervisorId: "m-abhishek-g", location: "All centres", employeeCode: "OWEMP-0028" },
  { id: "e-shiva", name: "Shiva Bhati", username: "shiva", password: "Shiva@123", role: "employee", designation: "sr-facility-executive", supervisorId: "m-abhishek-g", location: "All centres" },

  // Under Kamal Khanna
  { id: "e-priyanka-k", name: "Priyanka Kashyap", username: "priyanka.k", password: "Priyanka@123", role: "employee", designation: "front-desk-admin", supervisorId: "e5", location: "Noida Sector 126", employeeCode: "OWEMP-0025" },
  { id: "e-shyam", name: "Shyam Sundar", username: "shyam", password: "Shyam@123", role: "employee", designation: "helpdesk-executive", supervisorId: "e5", location: "Noida Sector 126", employeeCode: "OWEMP-0026" },

  // Under Kartik Sharma
  { id: "e-arun", name: "Arun Bhardwaj", username: "arun", password: "Arun@123", role: "employee", designation: "supervisor", supervisorId: "e12", location: "Mohan Cooperative" },
];

const TASKS = [
  { id: "t1", category: "Washroom", name: "WC / toilet pan clean, stain-free & odour-free — flush tested, no blockage" },
  { id: "t2", category: "Washroom", name: "Toilet seat & lid clean on both sides" },
  { id: "t4", category: "Washroom", name: "Toilet roll holder has sufficient paper — replace if below 30%" },
  { id: "t5", category: "Washroom", name: "Health faucet functional — no leakage" },
  { id: "t6", category: "Washroom", name: "Urinal (male WC) — sensor functional & clean — N/A for female WC" },
  { id: "t7", category: "Washroom", name: "Dustbin placed at end of WC cabin (not blocking door)" },
  { id: "t8", category: "Washroom", name: "Floor mopped — dry, no water puddles" },
  { id: "t9", category: "Washroom", name: "Floor tiles clean — no stains, debris or marks" },
  { id: "t10", category: "Washroom", name: "Walls clean — no stains, marks or graffiti" },
  { id: "t11", category: "Washroom", name: "Ceiling — no cobwebs, no seepage/dampness visible" },
  { id: "t12", category: "Washroom", name: "Skirting tiles clean and aligned" },
  { id: "t13", category: "Washroom", name: "Wash basins clean and dry after use" },
  { id: "t14", category: "Washroom", name: "Taps functional — no dripping or leakage" },
  { id: "t15", category: "Washroom", name: "Mirror clean, streak-free and uncracked" },
  { id: "t16", category: "Washroom", name: "Soap dispenser filled & functional — refill if less than 25%" },
  { id: "t17", category: "Washroom", name: "Plumbing fittings — no visible leakage under sink" },
  { id: "t18", category: "Washroom", name: "All lights functional (no flickering or dead bulbs)" },
  { id: "t19", category: "Washroom", name: "Exhaust fan/vent operational — no foul smell" },
  { id: "t20", category: "Washroom", name: "Air freshener dispenser working and filled" },
  { id: "t21", category: "Washroom", name: "Dustbin: clean liner fitted, less than 50% full, odour-free" },
  { id: "t22", category: "Washroom", name: "Doors & locks functional — latches working" },
  { id: "t23", category: "Washroom", name: "Washroom signage (Male/Female) in place" },
  { id: "t101", category: "Washroom", name: "Hand dryers are working fine." },
  { id: "t24", category: "Pantry", name: "Floor clean, mopped and dry — no spills" },
  { id: "t25", category: "Pantry", name: "Countertops and surfaces clean, non-sticky, odour-free" },
  { id: "t26", category: "Pantry", name: "Walls clean — no stains or marks" },
  { id: "t27", category: "Pantry", name: "Sink clean and drain clear — no food residue" },
  { id: "t28", category: "Pantry", name: "Taps functional — no dripping or leakage" },
  { id: "t29", category: "Pantry", name: "Soap dispenser at sink filled and functional" },
  { id: "t30", category: "Pantry", name: "Coffee/Tea machine clean — no spillage underneath (dry)" },
  { id: "t31", category: "Pantry", name: "Coffee/Tea machine stocked — pods/bags/sachets available" },
  { id: "t32", category: "Pantry", name: "Mugs/cups clean, sanitised and neatly stacked" },
  { id: "t33", category: "Pantry", name: "Microwave clean inside — no food residue or odour" },
  { id: "t34", category: "Pantry", name: "Refrigerator clean — no spills, no expired items — check expiry dates daily" },
  { id: "t35", category: "Pantry", name: "Water dispenser area clean — standard mat in place (18in front, 3in sides)" },
  { id: "t36", category: "Pantry", name: "Water dispenser functional — hot/cold working" },
  { id: "t37", category: "Pantry", name: "Cutlery, crockery, glassware clean, sanitised and ready" },
  { id: "t38", category: "Pantry", name: "Tea/coffee/sugar/creamer supplies stocked — reorder below 20% stock" },
  { id: "t39", category: "Pantry", name: "Napkins/tissues available" },
  { id: "t40", category: "Pantry", name: "Dustbin has clean liner, less than 50% full, odour-free" },
  { id: "t41", category: "Pantry", name: "All lights functional" },
  { id: "t42", category: "Pantry", name: "No cleaning linen/cloth visible to members — stored out of sight" },
  { id: "t43", category: "Pantry", name: "Cleaning chemicals stored correctly — correct dilution" },
  { id: "t44", category: "Pantry", name: "No foul/food smell in pantry area" },
  { id: "t45", category: "Pantry", name: "Storage areas (shelves/cabinets) dirt-free and organised" },
  { id: "t46", category: "Common Areas", name: "Entrance facade clean — signage maintained, painted, no damage" },
  { id: "t47", category: "Common Areas", name: "Glass doors/windows at entrance clean and streak-free" },
  { id: "t48", category: "Common Areas", name: "Reception desk clean and organised" },
  { id: "t49", category: "Common Areas", name: "Floor mat at entrance clean and in position" },
  { id: "t50", category: "Common Areas", name: "Floor tiles clean, floor mopped, and skirting tiles clean." },
  { id: "t51", category: "Common Areas", name: "All furniture clean and symmetrically arranged" },
  { id: "t52", category: "Common Areas", name: "Eating/dining area tables cleaned after every use — immediate clean after member use" },
  { id: "t53", category: "Common Areas", name: "Collab area organised — no personal items left behind" },
  { id: "t54", category: "Common Areas", name: "Dustbins clean, liner fitted, less than 50% full" },
  { id: "t55", category: "Common Areas", name: "Sprayed air fresheners throughout the centre." },
  { id: "t59", category: "Common Areas", name: "No cluttered/loose wiring on floors or ceilings" },
  { id: "t60", category: "Common Areas", name: "All glass surfaces clean, crack-free, handles intact" },
  { id: "t61", category: "Common Areas", name: "Televisions/screens clean and dust-free" },
  { id: "t62", category: "Common Areas", name: "Fire extinguishers clean, sealed and in place" },
  { id: "t63", category: "Common Areas", name: "Lights in all common areas functional" },
  { id: "t64", category: "Common Areas", name: "Pesto Flash (insect catcher) clean and operational" },
  { id: "t65", category: "Common Areas", name: "Blinds clean and functional in all areas" },
  { id: "t66", category: "Common Areas", name: "Walls and ceilings — no stains, cracks, tape marks, open fittings" },
  { id: "t67", category: "Common Areas", name: "Water dispenser has standard mat — 18in front, 3in sides" },
  { id: "t68", category: "Infra & Safety", name: "No loose or exposed wiring anywhere in centre — immediate escalation required" },
  { id: "t69", category: "Infra & Safety", name: "All switchboards clean, covers intact, no loose fittings" },
  { id: "t70", category: "Infra & Safety", name: "All light fixtures clean and dust-free" },
  { id: "t71", category: "Infra & Safety", name: "No flickering or dead bulbs in any area — log and replace same day" },
  { id: "t72", category: "Infra & Safety", name: "Junction boxes closed and properly fitted" },
  { id: "t73", category: "Infra & Safety", name: "Fire extinguishers in designated spots — seal intact" },
  { id: "t74", category: "Infra & Safety", name: "Emergency exit signage illuminated and unobstructed" },
  { id: "t75", category: "Infra & Safety", name: "No items blocking fire exits or emergency pathways" },
  { id: "t76", category: "Infra & Safety", name: "Smoke detectors visible — no physical damage" },
  { id: "t77", category: "Infra & Safety", name: "No pest sightings (cockroaches, rodents, ants) — log any sighting immediately" },
  { id: "t78", category: "Infra & Safety", name: "Pesto Flash (insect catcher) clean and light working" },
  { id: "t79", category: "Infra & Safety", name: "No standing water or food waste attracting pests" },
  { id: "t80", category: "Infra & Safety", name: "No seepage or damp patches on walls or ceilings" },
  { id: "t81", category: "Infra & Safety", name: "No water leakage from pipes, taps or fittings" },
  { id: "t82", category: "Infra & Safety", name: "No blockage in drains (washroom, pantry)" },
  { id: "t83", category: "Infra & Safety", name: "False ceiling grids intact — no water stains or cracks" },
  { id: "t84", category: "Infra & Safety", name: "Water dispenser drip tray clean and dry" },
  { id: "t85", category: "Soft Services", name: "Plants have clean, fresh-looking leaves (no yellowing/dead leaves)" },
  { id: "t86", category: "Soft Services", name: "Plants adequately watered — soil not dry or waterlogged" },
  { id: "t87", category: "Soft Services", name: "Plant pots clean — no dirt spillage around base" },
  { id: "t88", category: "Soft Services", name: "Decorative items / artwork clean and dust-free" },
  { id: "t89", category: "Soft Services", name: "All care staff in proper uniform — clean and presentable" },
  { id: "t90", category: "Soft Services", name: "Staff grooming standards met — hair, nails, hygiene" },
  { id: "t91", category: "Soft Services", name: "Staff are knowledgeable — know current task assignments" },
  { id: "t92", category: "Soft Services", name: "Cleaning linen/mops stored correctly — not visible to members" },
  { id: "t93", category: "Soft Services", name: "Cleaning chemicals diluted as per SOP — correct ratios" },
  { id: "t94", category: "Soft Services", name: "Chemical storage area clean, labelled, locked if required" },
  { id: "t95", category: "Soft Services", name: "Correct cleaning tools used for correct surfaces" },
  { id: "t96", category: "Soft Services", name: "Housekeeping log/register updated for the day" },
  { id: "t97", category: "Soft Services", name: "All dustbins emptied before reaching full" },
  { id: "t98", category: "Soft Services", name: "Dustbins clean, odour-free, swing flaps working" },
  { id: "t99", category: "Soft Services", name: "Segregated waste (if applicable) properly sorted" },
  { id: "t100", category: "Soft Services", name: "No waste bags/black bags visible in common areas" },
];

const ALL_TASK_IDS = TASKS.map((t) => t.id);

async function batchWrite(table, items) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }
  for (const chunk of chunks) {
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [table]: chunk.map((item) => ({ PutRequest: { Item: item } })),
      },
    }));
  }
}

async function seed() {
  const taskItems = TASKS.map((t) => ({
    id: t.id,
    category: t.category,
    name: t.name,
    frequency: "daily",
  }));
  await batchWrite(Tables.TASKS, taskItems);
  console.log(`Seeded ${taskItems.length} tasks.`);

  for (const user of USERS) {
    const hash = await bcrypt.hash(user.password, 10);
    const item = {
      id: user.id,
      name: user.name,
      username: user.username,
      password: hash,
      role: user.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (user.location) item.location = user.location;
    if (user.employeeCode) item.employee_code = user.employeeCode;
    if (user.phone) item.phone = user.phone;
    if (user.designation) item.designation = user.designation;
    if (user.supervisorId) item.supervisor_id = user.supervisorId;
    if (user.managerId) item.manager_id = user.managerId;
    await docClient.send(new PutCommand({
      TableName: Tables.USERS,
      Item: item,
    }));
  }
  console.log(`Seeded ${USERS.length} users.`);

  const userTaskItems = [];
  for (const user of USERS) {
    if (user.role !== "employee") continue;
    for (const taskId of ALL_TASK_IDS) {
      userTaskItems.push({ userId: user.id, taskId });
    }
  }
  await batchWrite(Tables.USER_TASKS, userTaskItems);
  console.log(`Seeded ${userTaskItems.length} user-task assignments.`);

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
