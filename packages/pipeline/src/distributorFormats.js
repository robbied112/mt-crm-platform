/**
 * Distributor Format Templates — pre-built column mappings
 * for known report formats from major distributors.
 *
 * When a file's headers match a known signature, the template
 * provides an instant mapping (0ms) without AI or rule-based detection.
 */

const DISTRIBUTOR_TEMPLATES = {
  // ── Southern Glazer's Wine & Spirits ──
  sgws_depletion: {
    systemId: "sgws",
    reportType: "depletion",
    headerPatterns: [
      /premise\s*type/i,
      /corp\s*item\s*cd/i,
    ],
    mapping: {
      acct: (h) => h.find(c => /account\s*name/i.test(c)),
      dist: () => "SGWS",
      st: (h) => h.find(c => /^state$/i.test(c) || /^st$/i.test(c)),
      ch: (h) => h.find(c => /premise\s*type/i.test(c)),
      sku: (h) => h.find(c => /item\s*desc/i.test(c) || /corp\s*item\s*cd/i.test(c)),
      qty: (h) => h.find(c => /^cases$/i.test(c) || /9l\s*cases/i.test(c)),
      date: (h) => h.find(c => /^week/i.test(c) || /^date/i.test(c)),
    },
    uploadType: "depletion",
  },

  // ── Breakthru Beverage Group ──
  breakthru_depletion: {
    systemId: "breakthru",
    reportType: "depletion",
    headerPatterns: [
      /item\s*(number|nbr)/i,
      /brand\s*family/i,
    ],
    mapping: {
      acct: (h) => h.find(c => /account\s*name/i.test(c) || /^account$/i.test(c)),
      dist: () => "Breakthru",
      st: (h) => h.find(c => /^state$/i.test(c)),
      ch: (h) => h.find(c => /premise/i.test(c) || /channel/i.test(c)),
      sku: (h) => h.find(c => /item\s*desc/i.test(c) || /brand\s*family/i.test(c)),
      qty: (h) => h.find(c => /depletion\s*qty/i.test(c) || /depl\s*cases/i.test(c)),
      date: (h) => h.find(c => /^date/i.test(c) || /^week/i.test(c)),
    },
    uploadType: "depletion",
  },

  // ── RNDC ──
  rndc_depletion: {
    systemId: "rndc",
    reportType: "depletion",
    headerPatterns: [
      /product\s*code/i,
      /cases\s*depleted/i,
    ],
    mapping: {
      acct: (h) => h.find(c => /acct\s*name/i.test(c) || /account/i.test(c)),
      dist: () => "RNDC",
      st: (h) => h.find(c => /^state$/i.test(c)),
      ch: (h) => h.find(c => /premise/i.test(c) || /channel/i.test(c)),
      sku: (h) => h.find(c => /product\s*desc/i.test(c) || /prod\s*cd/i.test(c)),
      qty: (h) => h.find(c => /cases\s*depleted/i.test(c) || /net\s*units/i.test(c)),
      date: (h) => h.find(c => /^date/i.test(c) || /^week/i.test(c)),
    },
    uploadType: "depletion",
  },

  // ── VIP / iDig — 4M Rolling Period ──
  vip_4m_rolling: {
    systemId: "vip",
    reportType: "depletion",
    headerPatterns: [
      /supplier\s*name/i,
      /prod\s*cd/i,
      /case\s*equivs/i,
    ],
    mapping: {
      acct: (h) => h.find(c => /account/i.test(c) || /acct/i.test(c)),
      dist: (h) => h.find(c => /supplier\s*name/i.test(c)),
      st: (h) => h.find(c => /^state$/i.test(c) || /^st$/i.test(c)),
      sku: (h) => h.find(c => /prod\s*desc/i.test(c)),
      qty: (h) => h.find(c => /case\s*equivs/i.test(c)),
    },
    uploadType: "depletion",
  },

  // ── QuickBooks Sales by Customer Detail ──
  quickbooks_sales: {
    systemId: "quickbooks",
    reportType: "revenue",
    headerPatterns: [
      /transaction\s*type/i,
      /product\/service/i,
    ],
    mapping: {
      acct: (h) => h.find(c => /customer/i.test(c) || /^name$/i.test(c)),
      revenue: (h) => h.find(c => /^amount$/i.test(c)),
      date: (h) => h.find(c => /^date$/i.test(c) || /transaction\s*date/i.test(c)),
      sku: (h) => h.find(c => /product\/service/i.test(c) || /memo/i.test(c) || /description/i.test(c)),
      qty: (h) => h.find(c => /quantity/i.test(c) || /^qty$/i.test(c)),
      ch: (h) => h.find(c => /customer\s*type/i.test(c) || /^type$/i.test(c)),
    },
    uploadType: "quickbooks",
  },
};

/**
 * Try to match headers against known distributor templates.
 * Returns { mapping, uploadType, templateId, systemId } or null.
 *
 * @param {string[]} headers - Column headers from the parsed file
 * @returns {object|null}
 */
function matchDistributorTemplate(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return null;

  for (const [templateId, template] of Object.entries(DISTRIBUTOR_TEMPLATES)) {
    const allMatch = template.headerPatterns.every(pattern =>
      headers.some(h => pattern.test(h))
    );
    if (!allMatch) continue;

    // Build concrete mapping by evaluating each function against headers
    const mapping = {};
    for (const [field, resolver] of Object.entries(template.mapping)) {
      const val = typeof resolver === "function" ? resolver(headers) : resolver;
      if (val) mapping[field] = val;
    }

    // Only return if we got at least 2 mapped fields
    if (Object.keys(mapping).length >= 2) {
      return {
        mapping,
        uploadType: template.uploadType,
        templateId,
        systemId: template.systemId,
      };
    }
  }

  return null;
}

module.exports = { DISTRIBUTOR_TEMPLATES, matchDistributorTemplate };
