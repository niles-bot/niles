class UnmetDependencyError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnmetDependencyError";
  }
}

/**
 * Checks for all required
 */
function check() {
  // node v12+ - discord.js 12.5.3
  let nodeVersion = Number(process.versions.node.split(".")[0]);
  if (nodeVersion < 12) {
    throw new UnmetDependencyError("Node Version");
  }
  // check for __dirname
  if (!__dirname) {
    throw new UnmetDependencyError("No __dirname");
  }
  return;
}

module.exports = {
  check
};
