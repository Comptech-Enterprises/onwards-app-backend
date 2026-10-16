const { User } = require("../models");

/**
 * Resolves Centre Manager (CM) and Cluster Manager hierarchy for a given user
 */
async function resolveUserHierarchy(userId, overrideData = {}) {
  const users = await User.find({}).lean();
  const userMap = new Map(users.map((u) => [u.id, u]));

  const emp = userMap.get(userId) || null;
  const employeeName = overrideData.employee_name || overrideData.employeeName || emp?.name || "Unknown";
  const employeeCode = emp?.employee_code || null;
  const designation = overrideData.designation || emp?.designation || "supervisor";
  const location = overrideData.location || emp?.location || "All centres";

  let cm = null;
  let clusterManager = null;

  if (overrideData.cm_id || overrideData.cmId) {
    const explicitCm = userMap.get(overrideData.cm_id || overrideData.cmId);
    if (explicitCm) cm = explicitCm;
  }

  if (!cm && emp) {
    if (emp.designation === "cm") {
      cm = emp;
      if (emp.manager_id) clusterManager = userMap.get(emp.manager_id);
    } else if (emp.supervisor_id) {
      const sup = userMap.get(emp.supervisor_id);
      if (sup) {
        if (sup.designation === "cm") {
          cm = sup;
          if (sup.manager_id) clusterManager = userMap.get(sup.manager_id);
        } else if (sup.designation === "cluster-manager" || sup.role === "manager") {
          clusterManager = sup;
        }
      }
    }

    // Fallback: match by centre location if not directly linked by supervisor_id
    if (!cm && location && location !== "All centres") {
      const locCm = users.find((x) => x.location === location && x.designation === "cm");
      if (locCm) {
        cm = locCm;
        if (locCm.manager_id) clusterManager = userMap.get(locCm.manager_id);
      }
    }
  }

  // If cluster manager still not found, check if cm has a manager_id
  if (!clusterManager && cm && cm.manager_id) {
    clusterManager = userMap.get(cm.manager_id);
  }

  const cmId = cm ? cm.id : (overrideData.cm_id || overrideData.cmId || null);
  const cmName = cm ? cm.name : (overrideData.cm_name || overrideData.cmName || null);
  const clusterManagerId = clusterManager ? clusterManager.id : (overrideData.cluster_manager_id || overrideData.clusterManagerId || null);
  const clusterManagerName = clusterManager ? clusterManager.name : (overrideData.cluster_manager_name || overrideData.clusterManagerName || null);
  const clusterManagerEmail = clusterManager ? clusterManager.email : null;

  return {
    employeeName,
    employeeCode,
    designation,
    location,
    cmId,
    cmName,
    clusterManagerId,
    clusterManagerName,
    clusterManagerEmail,
  };
}

module.exports = {
  resolveUserHierarchy,
};
