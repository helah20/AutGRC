/**
 * Domain catalogue.
 *
 * A "domain" is the unit the generator works in. Each domain owns a single
 * canonical requirement model; the Policy, Standard, Procedure, Roles, RACI,
 * Control Matrix and Evidence Register are all *renderings* of that one model.
 * That is what keeps the generated package internally consistent: if the
 * policy says privileged access requires MFA, it is because the requirement
 * `iam.mfa_privileged` says so, and the standard and procedure render the
 * same record.
 *
 * Numeric commitments (frequencies, thresholds, windows) live in
 * `parameters` and are referenced from text as {{placeholders}}. Changing a
 * parameter changes every document at once, and the consistency engine can
 * detect when a human edit has drifted away from the agreed value.
 */

export const DOMAIN_CATEGORIES = {
  govern: 'Govern',
  protect: 'Protect',
  detect: 'Detect & Respond',
  resilience: 'Resilience',
  assure: 'Assurance'
};

/** Ordered list of every supported domain. */
export const DOMAIN_META = [
  { key: 'governance', name: 'Governance', short: 'GOV', category: 'govern',
    description: 'Cybersecurity strategy, policy framework, organisational structure, oversight and regulatory compliance.' },
  { key: 'risk_management', name: 'Risk Management', short: 'RSK', category: 'govern',
    description: 'Identification, analysis, evaluation, treatment and acceptance of cybersecurity risk.' },
  { key: 'asset_management', name: 'Asset Management', short: 'AST', category: 'protect',
    description: 'Inventory, ownership, classification, acceptable use and secure disposal of information and technology assets.' },
  { key: 'iam', name: 'Identity & Access Management', short: 'IAM', category: 'protect',
    description: 'Identity lifecycle, authentication, authorisation, access provisioning and periodic access review.' },
  { key: 'pam', name: 'Privileged Access Management', short: 'PAM', category: 'protect',
    description: 'Control of administrative and high-impact access, credential vaulting, session recording and just-in-time elevation.' },
  { key: 'vulnerability_management', name: 'Vulnerability Management', short: 'VUL', category: 'protect',
    description: 'Discovery, classification, remediation and verification of technical vulnerabilities and security patches.' },
  { key: 'security_operations', name: 'Security Operations', short: 'SOC', category: 'detect',
    description: 'Day-to-day operation of security services, use-case management, shift handover and operational reporting.' },
  { key: 'incident_management', name: 'Incident Management', short: 'IRM', category: 'detect',
    description: 'Detection, triage, classification, containment, eradication, recovery, regulatory notification and lessons learned.' },
  { key: 'security_monitoring', name: 'Security Monitoring', short: 'MON', category: 'detect',
    description: 'Continuous monitoring, detection engineering, threat intelligence and alert triage.' },
  { key: 'third_party', name: 'Third-Party Security', short: 'TPS', category: 'protect',
    description: 'Supplier due diligence, contractual security requirements, ongoing assurance and secure offboarding.' },
  { key: 'data_protection', name: 'Data Protection', short: 'DAT', category: 'protect',
    description: 'Data classification, ownership, handling, retention, leakage prevention and privacy protection.' },
  { key: 'cryptography', name: 'Cryptography', short: 'CRY', category: 'protect',
    description: 'Approved algorithms, encryption of data in transit and at rest, and the cryptographic key lifecycle.' },
  { key: 'network_security', name: 'Network Security', short: 'NET', category: 'protect',
    description: 'Segmentation, perimeter defence, secure remote access, wireless security and network service hardening.' },
  { key: 'endpoint_security', name: 'Endpoint Security', short: 'END', category: 'protect',
    description: 'Workstation, server and mobile device protection, malware defence, hardening and removable media control.' },
  { key: 'cloud_security', name: 'Cloud Security', short: 'CLD', category: 'protect',
    description: 'Shared responsibility, cloud landing zone, configuration baselines, data residency and exit management.' },
  { key: 'application_security', name: 'Application Security', short: 'APP', category: 'protect',
    description: 'Security requirements, testing and protection of web, mobile and API-based applications in production.' },
  { key: 'secure_sdlc', name: 'Secure SDLC', short: 'SDL', category: 'protect',
    description: 'Security integrated into design, coding, testing, release and environment separation.' },
  { key: 'business_continuity', name: 'Business Continuity', short: 'BCM', category: 'resilience',
    description: 'Business impact analysis, continuity strategies, plans, exercising and cyber resilience.' },
  { key: 'disaster_recovery', name: 'Disaster Recovery', short: 'DRP', category: 'resilience',
    description: 'Technology recovery objectives, recovery plans, failover capability and recovery testing.' },
  { key: 'physical_security', name: 'Physical Security', short: 'PHY', category: 'protect',
    description: 'Perimeters, physical entry control, secure areas, environmental protection and equipment security.' },
  { key: 'security_awareness', name: 'Security Awareness', short: 'AWR', category: 'govern',
    description: 'Awareness programme, role-based training, phishing simulation and personnel security.' },
  { key: 'change_management', name: 'Change Management', short: 'CHG', category: 'protect',
    description: 'Security review of changes, configuration baselines, emergency change handling and back-out planning.' },
  { key: 'logging_monitoring', name: 'Logging & Monitoring', short: 'LOG', category: 'detect',
    description: 'Log source coverage, log integrity, time synchronisation, retention and log review.' },
  { key: 'backup_recovery', name: 'Backup & Recovery', short: 'BCK', category: 'resilience',
    description: 'Backup scope, scheduling, encryption, immutability, offsite copies and restoration testing.' }
];

export const DOMAIN_INDEX = Object.fromEntries(DOMAIN_META.map((d) => [d.key, d]));

export function domainName(key) {
  return DOMAIN_INDEX[key]?.name || key;
}

export function domainShort(key) {
  return DOMAIN_INDEX[key]?.short || String(key || '').slice(0, 3).toUpperCase();
}

/**
 * Resolve {{placeholders}} against a parameter map. Unknown placeholders are
 * left visible and reported, so a missing decision is never silently rendered
 * as an empty string in a governance document.
 */
export function resolveText(text, params = {}) {
  if (!text) return '';
  return String(text).replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

export function unresolvedPlaceholders(text) {
  const out = [];
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[1]);
  return out;
}
