/**
 * Industry template loader — loads and matches templates against data profiles.
 */

const depletionVelocity = require("./depletion-velocity.json");
const inventoryHealth = require("./inventory-health.json");
const executiveRollup = require("./executive-rollup.json");
const revenueOverview = require("./revenue-overview.json");
const pipelineReport = require("./pipeline-report.json");

const ALL_TEMPLATES = [
  depletionVelocity,
  inventoryHealth,
  executiveRollup,
  revenueOverview,
  pipelineReport,
];

/**
 * Match templates against a data profile.
 * Returns templates sorted by relevance (best match first).
 *
 * @param {object} dataProfile - Output of buildDataProfile()
 * @returns {object[]} Matched templates with match scores
 */
function matchTemplates(dataProfile) {
  // Collect all semantic types across all imports
  const availableSemantics = new Set();
  const availableFileTypes = new Set();

  for (const imp of dataProfile.imports || []) {
    if (imp.fileType) availableFileTypes.add(imp.fileType);
    for (const col of Object.values(imp.columns || {})) {
      if (col.semantic) availableSemantics.add(col.semantic);
    }
  }

  const matches = [];

  for (const template of ALL_TEMPLATES) {
    // Check file type match
    const fileTypeMatch = template.applicableFileTypes.some(
      (ft) => ft === "__any__" || availableFileTypes.has(ft)
    );

    // Check required semantics
    const requiredMet = template.requiredSemantics.every((s) => availableSemantics.has(s));

    // Score optional semantics
    const optionalCount = template.optionalSemantics.filter((s) => availableSemantics.has(s)).length;
    const optionalTotal = template.optionalSemantics.length || 1;
    const optionalScore = optionalCount / optionalTotal;

    // Only include if required semantics are met OR file type matches
    if (requiredMet || fileTypeMatch) {
      const score = (requiredMet ? 0.5 : 0) + (fileTypeMatch ? 0.3 : 0) + optionalScore * 0.2;
      matches.push({ template, score, requiredMet, fileTypeMatch });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Get a template by ID.
 */
function getTemplate(templateId) {
  return ALL_TEMPLATES.find((t) => t.templateId === templateId) || null;
}

module.exports = {
  ALL_TEMPLATES,
  matchTemplates,
  getTemplate,
};
