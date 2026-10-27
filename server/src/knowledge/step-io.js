/**
 * The input and output of each procedure step.
 *
 * A procedure written as a table of input, step, responsible and output is the
 * form Saudi organisations work from: each row states what starts the step and
 * what it hands on, so a step that produces nothing, or one that waits for
 * something no earlier step produces, is visible on the page.
 *
 * One entry per step, in step order: `[input, output]`. An input of null means
 * the step works on the output of the step before it, which is the usual case
 * and is filled in when the model is assembled, so the two are never authored
 * twice and cannot disagree. The first step always names its trigger. The
 * Arabic rendering is in ar/ar-step-io.js and must match this shape.
 */

export const STEP_IO = {
  iam: [
    ['A business need for access to a system', 'Access request recorded with role, justification and duration'],
    [null, 'Validated request screened for segregation-of-duties conflicts'],
    [null, 'Approved, amended or rejected request'],
    [null, 'Entitlement granted with MFA where required, and the action recorded'],
    [null, 'Confirmation that the granted access matches the approval'],
    ['The access review cycle', 'Each entitlement certified, modified or revoked'],
    ['A revocation decision, transfer or termination', 'Access removed across all systems, with evidence'],
    [null, 'Complete request record retained for audit']
  ],
  pam: [
    ['An approved change or incident that needs privileged access', 'Elevation request with task, system, reference and duration'],
    [null, 'Request with a validated reference and the minimum privilege level'],
    [null, 'Approved or rejected elevation'],
    [null, 'Active privileged session with recording enabled'],
    [null, 'Completed task with a recorded session'],
    ['The end of the approved duration', 'Privilege withdrawn and credential rotated'],
    ['Privileged activity alerts', 'Alerts confirmed as consistent or raised as incidents'],
    ['The privileged access review cycle', 'Recertified privileged entitlements, with unused ones removed']
  ],
  asset_management: [
    ['Acquisition or commissioning of an asset', 'Asset entry in the register with type, location, service and custodian'],
    [null, 'Classified and labelled asset'],
    [null, 'Named, accountable asset owner'],
    [null, 'Asset protected to the baseline for its classification'],
    ['Discovery scan output', 'Discrepancies investigated and the inventory corrected'],
    ['The inventory attestation cycle', 'Attested inventory, ownership and classification'],
    ['An asset reaching the end of its use', 'Sanitised asset, destruction evidence and a retired register entry']
  ],
  incident_management: [
    ['An alert, user report or observed anomaly', 'Event record with detection time, source and observations'],
    [null, 'Validated event with an assigned severity'],
    [null, 'Declared incident with a manager, a team, a timeline and a reportability decision'],
    [null, 'Contained incident, with CISO authorisation recorded where production was disrupted'],
    [null, 'Evidence acquired with hashes and chain of custody'],
    [null, 'Root cause removed and entry vector closed'],
    [null, 'Services restored from clean sources and validated'],
    ['The reportability decision', 'Regulatory and stakeholder notifications issued and recorded'],
    [null, 'Closed incident with a post-incident review and tracked improvement actions']
  ],
  vulnerability_management: [
    ['The scan schedule and the asset inventory', 'Scan results with coverage reconciled to the inventory'],
    [null, 'Confirmed, applicable findings with false positives removed'],
    [null, 'Findings rated by severity'],
    [null, 'Remediation assigned to a system owner with a due date'],
    [null, 'Patch, configuration change or mitigation applied through change management'],
    [null, 'Closure confirmed by rescan or retest'],
    ['The monthly reporting cycle', 'Vulnerability position report to management and the committee']
  ],
  third_party: [
    ['A procurement request and service description', 'Supplier assigned a risk tier'],
    [null, 'Due diligence result against the required security posture'],
    [null, 'Contract with the required cybersecurity clauses'],
    [null, 'Time-bound, least-privilege supplier access'],
    ['The supplier review cycle', 'Reassessment results with open findings tracked'],
    ['Termination of the contract', 'Access revoked and evidence of data return or destruction']
  ],
  data_protection: [
    ['Creation or acquisition of an information asset', 'Information asset registered with purpose, format and location'],
    [null, 'Classified and labelled information'],
    [null, 'Handling controls applied for the assigned level'],
    ['A request to share information outside the organisation', 'Approved or refused transfer with its conditions recorded'],
    ['Data leakage prevention events', 'Investigated events with violations recorded'],
    ['The retention schedule', 'Information retained, or disposed of securely with evidence']
  ],
  governance: [
    ['Regulatory change, a risk assessment, an audit finding or an incident lesson', 'Recorded need for a new or revised document'],
    [null, 'Draft document traceable to requirements and to the tier above'],
    [null, 'Draft with material comments resolved'],
    [null, 'Approved document with approver, date and version'],
    [null, 'Published document with acknowledgement recorded'],
    ['The compliance assessment cycle', 'Compliance assessment with gaps recorded as findings'],
    ['The review date or a material change', 'Reviewed document, reissued or retired']
  ],
  risk_management: [
    ['The asset inventory, business processes and risk appetite', 'Agreed assessment scope and context'],
    [null, 'Identified threats, vulnerabilities and existing controls'],
    [null, 'Inherent and residual risk ratings'],
    [null, 'Treatment plan with actions, owners and due dates'],
    [null, 'Approved treatment plan or time-bound risk acceptance'],
    [null, 'Risk register updated and the risk position reported']
  ],
  security_awareness: [
    ['Incident trends, audit findings, regulatory change and role risk', 'Identified awareness needs'],
    [null, 'General and role-based training content'],
    [null, 'Assigned training with completion tracked'],
    ['The simulation schedule', 'Click and reporting rates per campaign'],
    [null, 'Coaching records for repeated susceptibility'],
    [null, 'Report to the committee and a content refresh plan']
  ],
  hr_security: [
    ['A joining, change of role or departure', 'Recorded event and notification to cybersecurity and IT'],
    [null, 'Completed screening result'],
    [null, 'Signed employment terms and confidentiality agreement'],
    [null, 'Access granted for the role, or superseded access removed'],
    ['A departure notification', 'Access revoked and assets and credentials recovered'],
    [null, 'Signed acknowledgement of continuing obligations'],
    ['The personnel register and the list of active accounts', 'Reconciliation report with mismatches and their causes']
  ],
  change_management: [
    ['A need to change a system', 'Change record with plan and back-out plan'],
    [null, 'Classified change with the need for security review decided'],
    [null, 'Security impact assessment recorded on the change'],
    [null, 'Approved, deferred or rejected change'],
    [null, 'Implemented change with verified controls and logging'],
    ['Emergency and unapproved changes', 'Review findings and investigation records']
  ],
  cryptography: [
    ['A request for keys, certificates or encryption', 'Required cryptographic protection for the data and path'],
    [null, 'Selected approved algorithms and protocol versions'],
    [null, 'Generated keys stored with named custodians'],
    [null, 'Encryption applied and validated by configuration scan'],
    ['Scan results and certificate expiry dates', 'Deprecated cryptography and expiring certificates flagged'],
    ['The rotation schedule', 'Rotated keys and retired algorithms recorded through change']
  ],
  network_security: [
    ['A new system or a change to the network', 'Defined zone, trust boundary and enforcement point'],
    ['A business need for network connectivity', 'Rule request with source, destination, service and duration'],
    [null, 'Assessed request against the segmentation model'],
    [null, 'Implemented rule with owner and review date'],
    [null, 'Confirmed rule behaviour with no external management exposure'],
    ['The rule base review cycle', 'Reviewed rule base with unused and expired rules removed']
  ],
  email_security: [
    ['The mail systems, sending services and domains', 'Register of sending services covered by sender authentication'],
    ['Inbound email', 'Filtered email with external messages marked'],
    ['User reports and threat detections', 'Messages classified as malicious or legitimate, and acted on'],
    ['A request to change payment details', 'Request confirmed or rejected by call-back'],
    [null, 'Archived email and a recovery test result'],
    ['The review cycle', 'Review findings for protection gaps']
  ],
  database_security: [
    ['A new or discovered database', 'Database register entry with owner and classification'],
    [null, 'Database configured to baseline in the database zone'],
    ['An access request', 'Named administrator and per-application service accounts'],
    [null, 'Audit events forwarded centrally and encryption applied'],
    ['Released security patches and the test schedule', 'Patched database and a recovery test result'],
    ['The review cycle', 'Review findings for protection gaps']
  ],
  ot_security: [
    ['The facility list and the approved levelling method', 'Facility level and applicable controls recorded'],
    [null, 'OT/ICS asset inventory with owners and criticality'],
    [null, 'Documented zones and data flows, with segmentation enforced'],
    ['A change or remote access request', 'Assessed and approved or refused request'],
    ['OT/ICS events and vulnerability data', 'Monitored events and vulnerability assessment results'],
    ['The exercise and review schedule', 'Exercise results and control review findings']
  ],
  social_media_security: [
    ['A request to open an official account', 'Risk assessment and an approval decision'],
    [null, 'Registered, verified account added to the inventory'],
    [null, 'Account secured with a vaulted password, MFA and named users'],
    ['Account and platform activity', 'Unauthorised activity and impersonation detected'],
    ['A suspected account takeover', 'Recovered account with the incident recorded'],
    ['The review cycle', 'Reviewed access and account configuration']
  ],
  endpoint_security: [
    ['A new endpoint', 'Endpoint built from the approved image to baseline'],
    [null, 'Protection installed and reporting to monitoring'],
    [null, 'Mobile device enrolled and encrypted'],
    ['Compliance and agent health data', 'Non-compliant or silent endpoints identified'],
    [null, 'Configuration restored with the cause of drift recorded'],
    ['An endpoint leaving service', 'Wiped, unenrolled and sanitised endpoint']
  ],
  application_security: [
    ['A new application or a change to one', 'Testable security requirements as acceptance criteria'],
    [null, 'Design review result with identified threats'],
    [null, 'Static, dependency and dynamic test findings'],
    [null, 'Remediated and verified critical findings'],
    [null, 'Application behind a web application firewall with events forwarded'],
    ['The retest schedule or a material change', 'Retest results']
  ],
  secure_sdlc: [
    ['A project initiation', 'Security requirements and, for critical applications, a threat model'],
    [null, 'Peer-reviewed code against the secure coding standard'],
    [null, 'Scan results for code, dependencies and secrets'],
    [null, 'Dynamic test results on masked data'],
    [null, 'Release approved at the security gate, or held'],
    ['Component vulnerabilities after release', 'Remediated components under the vulnerability service levels']
  ],
  physical_security: [
    ['The sites and what each area contains', 'Defined security zones with entry requirements'],
    ['A request for badge access', 'Approved or refused access recorded against the individual'],
    [null, 'Badge issued and registered with the approved permissions'],
    ['A visitor arrival', 'Registered visitor with a host and a distinct badge'],
    ['Surveillance, intrusion and environmental alerts', 'Investigated anomalies'],
    ['The access review cycle or a termination', 'Reviewed access and revoked badges']
  ],
  logging_monitoring: [
    ['The asset register', 'Required log sources reconciled to the inventory'],
    [null, 'Sources forwarding complete, correctly timestamped events'],
    [null, 'Logs protected against alteration by administrators'],
    [null, 'Triaged exceptions with unauthorised activity raised'],
    ['Source health reports', 'Silent sources restored'],
    ['The retention schedule', 'Logs retained, or disposed of securely']
  ],
  security_monitoring: [
    ['The required telemetry sources', 'Onboarded sources with validated event quality'],
    [null, 'Validated detection use case with owner and response'],
    [null, 'Alerts in the triage queue'],
    [null, 'Alert disposition with rationale, or a declared incident'],
    ['False positive rates', 'Tuned use cases'],
    ['The threat model and the review cycle', 'Coverage review and new use cases commissioned']
  ],
  security_operations: [
    ['The previous shift handover', 'Reviewed open incidents, suppressions and tooling health'],
    [null, 'Confirmed tooling health, or degraded tooling raised'],
    [null, 'Security services delivered to their service levels'],
    ['Confirmed incidents and service level breaches', 'Escalations recorded on the documented path'],
    ['The end of the shift', 'Completed handover record'],
    ['The reporting cycle', 'Service performance report to management']
  ],
  cloud_security: [
    ['A request to adopt a cloud service', 'Data classification and provider assessment'],
    [null, 'Agreed shared responsibility matrix'],
    [null, 'Landing zone built to baseline with identity and logging enabled'],
    [null, 'Posture scan result before go-live'],
    ['The posture scan and access review cycles', 'Posture findings and reviewed privileged access'],
    ['The exit plan review cycle', 'Tested exit plan with data extraction confirmed']
  ],
  business_continuity: [
    ['The business impact analysis cycle', 'Recovery objectives and dependencies'],
    [null, 'Selected continuity strategy'],
    [null, 'Continuity plan with invocation criteria and roles'],
    ['The exercise schedule', 'Exercise results'],
    [null, 'Shortfalls recorded as findings and plans updated'],
    ['The plan review cycle or an invocation', 'Reviewed continuity plan']
  ],
  disaster_recovery: [
    ['The business impact analysis', 'Recovery time and recovery point objectives'],
    [null, 'Recovery capability design with verified site independence'],
    [null, 'Recovery plan with sequence, dependencies and invocation authority'],
    ['The test schedule', 'Measured recovery time and data loss'],
    ['A disaster or cyber incident', 'Service restored to a verified clean state'],
    [null, 'Updated plans and tracked findings']
  ],
  backup_recovery: [
    ['The recovery point objective of each system', 'Backup scope and schedule'],
    [null, 'Encrypted backup jobs with the agreed frequency and retention'],
    [null, 'Immutable, offsite backups with separate administration'],
    ['Backup job results', 'Investigated failures'],
    ['The restore test schedule', 'Verified restore result'],
    ['The asset inventory', 'Backup scope reconciled with new systems added']
  ]
};

/**
 * Attach input and output to a list of steps. A step whose input is not
 * authored takes the output of the one before it.
 */
export function withStepIo(steps, io) {
  if (!io) return steps;
  return steps.map((step, i) => ({
    ...step,
    input: io[i]?.[0] ?? (i > 0 ? io[i - 1]?.[1] : null) ?? null,
    output: io[i]?.[1] ?? null
  }));
}
