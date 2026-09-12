/**
 * Cybersecurity role library.
 *
 * Each role is the source for a generated Roles & Responsibilities document
 * and supplies the column definitions used by the RACI builder. The `code`
 * is the key referenced from every domain's `raciActivities`.
 */

export const ROLE_LIBRARY = [
  {
    code: 'ciso', name: 'Chief Information Security Officer', shortName: 'CISO', category: 'Leadership',
    purpose: 'To lead the cybersecurity function, set the security direction for {{orgName}}, and provide executive management and the board with an accurate view of cybersecurity risk and regulatory compliance.',
    reportingLine: 'Reports to the Chief Executive Officer or Board Risk Committee, independent of the Information Technology function whose controls the role assures.',
    authority: 'Authorised to approve cybersecurity policies and standards, accept or escalate cybersecurity risk within the delegated appetite, authorise containment action that disrupts production services during an incident, and halt a change or release that would introduce unacceptable cybersecurity risk.',
    competencies: ['Cybersecurity strategy and governance', 'Regulatory compliance in the applicable jurisdiction', 'Enterprise risk management', 'Incident command and crisis communication', 'Security architecture at enterprise scale', 'Board-level communication of technical risk'],
    interfaces: [
      { role: 'Executive Management', nature: 'Reports the cybersecurity risk position and secures funding for the security roadmap.' },
      { role: 'Cybersecurity GRC Manager', nature: 'Directs the governance, compliance and assurance programme.' },
      { role: 'IT Manager', nature: 'Agrees control implementation and remediation priorities.' },
      { role: 'Risk Manager', nature: 'Aligns cybersecurity risk into the enterprise risk framework.' },
      { role: 'Internal Auditor', nature: 'Provides evidence for independent assurance and responds to findings.' }
    ],
    responsibilities: [
      'Define and maintain the cybersecurity strategy, and secure executive approval for it.',
      'Own the cybersecurity policy framework and ensure it remains current and enforceable.',
      'Establish the cybersecurity organisational structure with clear roles and adequate independence.',
      'Direct the cybersecurity risk management programme and maintain visibility of risk above appetite.',
      'Act as incident commander for Severity 1 cybersecurity incidents.',
      'Ensure regulatory notification obligations are met within the required timeframes.',
      'Report the cybersecurity position to executive management and the board on the agreed cycle.'
    ],
    accountabilities: [
      'Accountable for the adequacy and effectiveness of the cybersecurity control environment.',
      'Accountable for the accuracy of the cybersecurity risk position reported to the board.',
      'Accountable for cybersecurity regulatory compliance status.',
      'Accountable for the organisation\'s readiness to respond to cybersecurity incidents.'
    ],
    activities: [
      'Chair or attend the Cybersecurity Steering Committee.',
      'Review and approve cybersecurity policies, standards and exceptions.',
      'Review privileged access and critical risk positions on the defined cycle.',
      'Authorise penetration testing scope and review results.',
      'Direct post-incident reviews and approve improvement plans.'
    ],
    approvals: [
      'Cybersecurity policies and standards.',
      'Risk acceptance within the delegated cybersecurity risk appetite.',
      'Privileged access requests to critical systems.',
      'Disruptive containment actions during a cybersecurity incident.',
      'Exceptions to cybersecurity requirements, including vulnerability remediation exceptions.'
    ],
    escalations: [
      'Escalate Critical residual risk and Severity 1 incidents to Executive Management and the Board Risk Committee.',
      'Escalate regulatory reportability determinations to Legal without waiting for investigation to conclude.',
      'Escalate systemic non-compliance with the cybersecurity policy framework to the Chief Executive Officer.'
    ],
    domains: ['governance', 'risk_management', 'incident_management', 'pam']
  },
  {
    code: 'grc_manager', name: 'Cybersecurity GRC Manager', shortName: 'GRC Manager', category: 'Governance',
    purpose: 'To operate the cybersecurity governance, risk and compliance programme, ensuring that the policy framework, control library, compliance obligations and assurance activities remain current, mapped and evidenced.',
    reportingLine: 'Reports to the Chief Information Security Officer.',
    authority: 'Authorised to require evidence of control operation from control owners, to record and escalate control failures, to maintain the compliance obligations register, and to reject governance documents that do not meet the framework requirements.',
    competencies: ['Cybersecurity control frameworks including NCA ECC, ISO/IEC 27001 and NIST CSF', 'Policy and standard authorship', 'Control design and testing', 'Compliance gap assessment', 'Audit management and evidence preparation'],
    interfaces: [
      { role: 'CISO', nature: 'Reports governance, compliance and assurance status.' },
      { role: 'Control Owners', nature: 'Collects control evidence and tracks remediation.' },
      { role: 'Internal Auditor', nature: 'Coordinates audit scheduling and manages findings to closure.' },
      { role: 'Risk Manager', nature: 'Aligns control gaps with the risk register.' },
      { role: 'System Owners', nature: 'Agrees remediation plans and evidence requirements.' }
    ],
    responsibilities: [
      'Draft, maintain and version-control cybersecurity policies, standards and procedures.',
      'Maintain the control library, including control ownership, evidence requirements and testing frequency.',
      'Maintain the compliance obligations register and map obligations to operating controls.',
      'Conduct periodic control assessments and record gaps as findings with owners and due dates.',
      'Coordinate internal and external audits and manage the findings register to closure.',
      'Produce cybersecurity compliance and control reporting for management and committee.'
    ],
    accountabilities: [
      'Accountable for the currency and completeness of the cybersecurity policy framework.',
      'Accountable for the accuracy of the framework-to-control mapping used for compliance reporting.',
      'Accountable for tracking findings through to evidenced closure.'
    ],
    activities: [
      'Run the annual policy review cycle and report documents overdue for review.',
      'Operate the control testing schedule and collect evidence.',
      'Assess regulatory change for impact within 30 days of publication.',
      'Facilitate access review, risk assessment and gap assessment campaigns.',
      'Maintain the traceability from framework requirement to control, document and evidence.'
    ],
    approvals: [
      'Control evidence sufficiency for assurance purposes.',
      'Governance document readiness for approval submission.',
      'Segregation-of-duties conflict dispositions.'
    ],
    escalations: [
      'Escalate control failures to the CISO within 1 business day.',
      'Escalate overdue findings past their due date to the accountable owner\'s line management.',
      'Escalate compliance gaps with regulatory exposure to the CISO and Legal.'
    ],
    domains: ['governance', 'risk_management', 'third_party']
  },
  {
    code: 'cyber_analyst', name: 'Cybersecurity Analyst', shortName: 'Cyber Analyst', category: 'Operations',
    purpose: 'To perform day-to-day cybersecurity analysis, control monitoring and technical assessment activities that support the detection, prevention and assurance of the security control environment.',
    reportingLine: 'Reports to the Cybersecurity GRC Manager or Security Operations lead.',
    authority: 'Authorised to investigate security events, request evidence from system owners, raise cybersecurity incidents, and recommend blocking or isolation actions to the incident manager.',
    competencies: ['Security event analysis and investigation', 'Control testing and evidence collection', 'Vulnerability assessment tooling', 'Network and endpoint technology fundamentals', 'Scripting and data analysis'],
    interfaces: [
      { role: 'SOC Analyst', nature: 'Shares investigative findings and tuning recommendations.' },
      { role: 'IT Manager', nature: 'Requests configuration evidence and remediation.' },
      { role: 'Cybersecurity GRC Manager', nature: 'Supplies control testing results and assessment output.' }
    ],
    responsibilities: [
      'Analyse security events and investigate anomalies to a documented disposition.',
      'Execute control testing and collect evidence for assurance activities.',
      'Operate vulnerability scanning and validate findings before assignment.',
      'Support risk assessments with technical threat and vulnerability analysis.',
      'Maintain detection use cases and tune them to reduce false positives.'
    ],
    accountabilities: [
      'Accountable for the accuracy of analysis and dispositions recorded against security events.',
      'Accountable for the completeness of evidence collected for assigned controls.'
    ],
    activities: [
      'Triage assigned security alerts within the applicable service level.',
      'Run scheduled vulnerability scans and reconcile coverage.',
      'Review configuration compliance reports and raise deviations.',
      'Assess threat intelligence advisories for applicability.'
    ],
    approvals: ['False positive closure of security alerts within the delegated severity level.'],
    escalations: [
      'Escalate confirmed security incidents to the Incident Response Analyst immediately.',
      'Escalate control evidence that cannot be obtained to the Cybersecurity GRC Manager.',
      'Escalate actively exploited vulnerabilities to the CISO without delay.'
    ],
    domains: ['security_monitoring', 'vulnerability_management', 'security_operations']
  },
  {
    code: 'security_architect', name: 'Security Architect', shortName: 'Architect', category: 'Architecture',
    purpose: 'To define the target security architecture and ensure that solutions, platforms and changes are designed to meet {{orgName}} security requirements before they are built.',
    reportingLine: 'Reports to the Chief Information Security Officer.',
    authority: 'Authorised to define security design patterns and standards, to require design changes where security requirements are not met, and to escalate designs that cannot be made compliant.',
    competencies: ['Enterprise and cloud security architecture', 'Threat modelling', 'Identity and cryptographic architecture', 'Network segmentation design', 'Secure development and platform engineering'],
    interfaces: [
      { role: 'System Owner', nature: 'Agrees security requirements and design decisions for their systems.' },
      { role: 'IT Manager', nature: 'Aligns architecture with platform capability and operational reality.' },
      { role: 'CISO', nature: 'Escalates architectural risk and proposes strategic capability investment.' }
    ],
    responsibilities: [
      'Define and maintain security architecture patterns, reference designs and baselines.',
      'Conduct security design reviews and threat modelling for critical systems and changes.',
      'Define cryptographic standards and key management architecture.',
      'Define network segmentation and trust boundary models.',
      'Advise on secure cloud landing zone design and shared responsibility.'
    ],
    accountabilities: [
      'Accountable for the technical adequacy of approved security designs.',
      'Accountable for the currency of security architecture standards and patterns.'
    ],
    activities: [
      'Review solution designs against the security requirements at project gates.',
      'Maintain the approved cryptographic algorithm and protocol list.',
      'Review firewall requests that cross critical trust boundaries.',
      'Approve promotion of releases through the pipeline security gate.'
    ],
    approvals: ['Security design approval at project gates.', 'Deviations from approved architecture patterns.', 'Cryptographic algorithm selections outside the standard list.'],
    escalations: ['Escalate designs that cannot meet security requirements to the CISO for risk acceptance.', 'Escalate systemic architectural weaknesses to the Cybersecurity Steering Committee.'],
    domains: ['network_security', 'cryptography', 'cloud_security', 'secure_sdlc']
  },
  {
    code: 'soc_analyst', name: 'SOC Analyst', shortName: 'SOC Analyst', category: 'Operations',
    purpose: 'To monitor the environment for adverse security events, triage alerts against defined playbooks, and escalate confirmed incidents without delay.',
    reportingLine: 'Reports to the Security Operations lead, within the cybersecurity function.',
    authority: 'Authorised to investigate alerts, query security telemetry, close alerts as false positive within the delegated severity level, and declare a suspected incident for escalation.',
    competencies: ['Security monitoring platform operation', 'Alert triage and investigation methodology', 'Log analysis and correlation', 'Adversary behaviour models', 'Incident documentation'],
    interfaces: [
      { role: 'Incident Response Analyst', nature: 'Escalates confirmed incidents with investigative context.' },
      { role: 'Cybersecurity Analyst', nature: 'Feeds tuning recommendations into detection engineering.' },
      { role: 'IT Manager', nature: 'Requests containment support and system context.' }
    ],
    responsibilities: [
      'Monitor security alerts across the coverage window and triage within the applicable service level.',
      'Investigate alerts following documented playbooks and record the disposition rationale.',
      'Escalate confirmed incidents to the Incident Response Analyst.',
      'Complete shift handover recording open investigations and active suppressions.',
      'Verify security tooling health at the start of every shift.'
    ],
    accountabilities: [
      'Accountable for triage within the applicable service level for assigned alerts.',
      'Accountable for the completeness of the handover record at shift end.'
    ],
    activities: ['Triage the alert queue continuously during the shift.', 'Verify telemetry ingestion and tooling availability.', 'Record investigative steps and evidence against each alert.'],
    approvals: ['Closure of Severity 3 and Severity 4 alerts as false positive or benign.'],
    escalations: [
      'Escalate Severity 1 alerts to the Incident Response Analyst and CISO immediately.',
      'Escalate degraded security tooling to the IT Manager as an operational incident.',
      'Escalate privileged activity inconsistent with an approved task immediately.'
    ],
    domains: ['security_monitoring', 'security_operations', 'incident_management']
  },
  {
    code: 'ir_analyst', name: 'Incident Response Analyst', shortName: 'IR Analyst', category: 'Operations',
    purpose: 'To lead the technical investigation, containment, eradication and recovery of cybersecurity incidents, and to preserve evidence to a standard that supports subsequent legal and regulatory action.',
    reportingLine: 'Reports to the Chief Information Security Officer during incident response, and to the Security Operations lead otherwise.',
    authority: 'Authorised to direct technical response activity during an incident, to request evidence and system access needed for investigation, and to recommend containment actions to the CISO.',
    competencies: ['Digital forensics and evidence handling', 'Malware and intrusion analysis', 'Incident containment and eradication techniques', 'Chain of custody and legal admissibility', 'Incident documentation and timeline construction'],
    interfaces: [
      { role: 'CISO', nature: 'Seeks authorisation for disruptive containment and reports incident status.' },
      { role: 'IT Manager', nature: 'Directs technical containment and recovery execution.' },
      { role: 'Legal', nature: 'Supports regulatory reportability assessment with technical facts.' },
      { role: 'SOC Analyst', nature: 'Receives escalated alerts with investigative context.' }
    ],
    responsibilities: [
      'Declare, classify and manage cybersecurity incidents through to closure.',
      'Maintain the incident timeline and evidence package throughout the response.',
      'Acquire and preserve forensic evidence with documented chain of custody.',
      'Identify root cause and entry vector before recovery commences.',
      'Produce the post-incident review with findings and improvement actions.'
    ],
    accountabilities: [
      'Accountable for the integrity and completeness of incident evidence.',
      'Accountable for confirming the entry vector is closed before recovery is authorised.',
      'Accountable for the accuracy of the incident record and timeline.'
    ],
    activities: ['Lead technical response on declared incidents.', 'Coordinate forensic acquisition with internal teams or the retained provider.', 'Assess and record regulatory reportability at declaration.', 'Facilitate the post-incident review.'],
    approvals: ['Confirmation that eradication is complete and recovery may proceed.', 'Evidence release to Legal or external counsel.'],
    escalations: [
      'Escalate Severity 1 incidents to the CISO and Executive Management immediately.',
      'Escalate suspected insider involvement to the CISO and Human Resources under restricted distribution.',
      'Escalate containment requiring production disruption to the CISO for authorisation.'
    ],
    domains: ['incident_management', 'security_monitoring', 'disaster_recovery']
  },
  {
    code: 'vuln_specialist', name: 'Vulnerability Management Specialist', shortName: 'Vuln Specialist', category: 'Operations',
    purpose: 'To operate the vulnerability management lifecycle, ensuring that technical vulnerabilities across the estate are discovered, prioritised by real risk, assigned and verified as remediated.',
    reportingLine: 'Reports to the Cybersecurity GRC Manager or Security Operations lead.',
    authority: 'Authorised to schedule and execute vulnerability scanning, assign remediation to system owners with service-level due dates, and reopen findings where verification fails.',
    competencies: ['Vulnerability scanning platforms and authenticated scanning', 'Exploitability and risk-based prioritisation', 'Patch management across platforms', 'Penetration test management', 'Asset reconciliation'],
    interfaces: [
      { role: 'System Owner', nature: 'Assigns remediation and agrees due dates.' },
      { role: 'IT Manager', nature: 'Coordinates patch deployment and scan credentials.' },
      { role: 'Cybersecurity GRC Manager', nature: 'Reports the vulnerability position and exception requests.' }
    ],
    responsibilities: [
      'Execute scheduled internal, external and authenticated vulnerability scanning.',
      'Validate findings and remove false positives before assignment.',
      'Prioritise vulnerabilities using exploitability, exposure and asset criticality.',
      'Assign remediation with due dates derived from the approved service levels.',
      'Verify remediation by re-scan before closing any finding.',
      'Maintain the vulnerability exception register with expiry dates.'
    ],
    accountabilities: [
      'Accountable for scan coverage against the authorised asset inventory.',
      'Accountable for the accuracy of severity assignment.',
      'Accountable for verified closure of vulnerability findings.'
    ],
    activities: ['Run the scanning schedule and reconcile coverage to the asset register.', 'Produce the vulnerability ageing and service-level compliance report.', 'Coordinate penetration testing engagements and retest closure.'],
    approvals: ['Closure of findings following successful verification.', 'False positive determinations.'],
    escalations: [
      'Escalate Critical vulnerabilities overdue against the service level to the CISO.',
      'Escalate actively exploited vulnerabilities to Executive Management where not addressed in the emergency window.',
      'Escalate evidence of exploitation to the Incident Management process immediately.'
    ],
    domains: ['vulnerability_management', 'change_management']
  },
  {
    code: 'iam_specialist', name: 'IAM Specialist', shortName: 'IAM Specialist', category: 'Operations',
    purpose: 'To operate the identity and access management lifecycle so that access is provisioned only on documented authorisation, is least-privileged, and is revoked promptly when no longer required.',
    reportingLine: 'Reports to the IT Manager, with a functional reporting line to the Chief Information Security Officer.',
    authority: 'Authorised to provision and revoke access following documented approval, to reject requests lacking valid authorisation, and to disable accounts presenting immediate risk pending investigation.',
    competencies: ['Directory and identity provider administration', 'Role-based access control design', 'Privileged access management platforms', 'Access certification campaign operation', 'Segregation-of-duties analysis'],
    interfaces: [
      { role: 'System Owner', nature: 'Obtains authorisation for access and supports recertification.' },
      { role: 'Human Resources', nature: 'Receives joiner, mover and leaver events.' },
      { role: 'Cybersecurity GRC Manager', nature: 'Supplies access review evidence and conflict dispositions.' }
    ],
    responsibilities: [
      'Provision access following documented approval and within the agreed service level.',
      'Verify that granted entitlements match those approved.',
      'Revoke access on termination, transfer and engagement completion within the required window.',
      'Operate access certification campaigns and track revocations to completion.',
      'Maintain the role-to-entitlement catalogue and service account register.',
      'Screen access requests against the segregation-of-duties conflict matrix.'
    ],
    accountabilities: [
      'Accountable for provisioning only what was approved.',
      'Accountable for revocation timeliness against the leaver service level.',
      'Accountable for the accuracy of the entitlement position presented at review.'
    ],
    activities: ['Process access requests and revocations daily.', 'Run dormant and orphaned account reporting monthly.', 'Support privileged access recertification cycles.', 'Onboard privileged accounts to the credential vault.'],
    approvals: ['Technical validation that a request is complete and correctly authorised.'],
    escalations: [
      'Escalate revocations not completed within the service level to the Cybersecurity GRC Manager as a control failure.',
      'Escalate requests that create unmitigated segregation-of-duties conflicts to the Risk Manager.',
      'Escalate discovery of unmanaged privileged accounts to the Cybersecurity GRC Manager.'
    ],
    domains: ['iam', 'pam']
  },
  {
    code: 'risk_manager', name: 'Risk Manager', shortName: 'Risk Manager', category: 'Governance',
    purpose: 'To maintain the cybersecurity risk management methodology and register, ensuring that risk is identified, assessed consistently, treated in line with appetite and reported accurately.',
    reportingLine: 'Reports to the Chief Risk Officer or, where no such role exists, to the Chief Information Security Officer.',
    authority: 'Authorised to require risk assessments before significant change, to challenge risk ratings and treatment plans, and to escalate risk above appetite to the Cybersecurity Steering Committee.',
    competencies: ['Risk assessment methodology and quantification', 'Enterprise risk framework integration', 'Control effectiveness evaluation', 'Risk reporting to executive audiences'],
    interfaces: [
      { role: 'CISO', nature: 'Aligns the cybersecurity risk position with the security strategy.' },
      { role: 'Business Owner', nature: 'Agrees risk ownership and treatment decisions.' },
      { role: 'Internal Auditor', nature: 'Provides the risk position as audit planning input.' }
    ],
    responsibilities: [
      'Maintain the cybersecurity risk methodology and evaluation criteria.',
      'Facilitate risk assessments for projects, changes and outsourcing arrangements.',
      'Maintain the cybersecurity risk register with named risk owners.',
      'Track treatment plans to completion and report progress.',
      'Administer risk acceptance, ensuring acceptances are time-bound and re-evaluated on expiry.'
    ],
    accountabilities: [
      'Accountable for the consistency of risk rating across assessments.',
      'Accountable for the accuracy and completeness of the cybersecurity risk register.',
      'Accountable for ensuring no risk acceptance remains in force past its expiry.'
    ],
    activities: ['Run the quarterly risk register review.', 'Facilitate assessment workshops with business and technology stakeholders.', 'Prepare the risk position for the Steering Committee.'],
    approvals: ['Risk rating and residual risk determination.', 'Treatment plan adequacy before submission for approval.'],
    escalations: ['Escalate Critical residual risk to the Steering Committee within 5 business days.', 'Escalate treatment plans overdue beyond their due date to the CISO.', 'Escalate unmitigated segregation-of-duties conflicts for decision.'],
    domains: ['risk_management', 'governance', 'business_continuity']
  },
  {
    code: 'asset_owner', name: 'Asset Owner', shortName: 'Asset Owner', category: 'Business',
    purpose: 'To be accountable for an information or technology asset throughout its lifecycle, including its classification, protection requirements, acceptable use and secure disposal.',
    reportingLine: 'Reports within the business or technology function that owns the asset.',
    authority: 'Authorised to determine asset classification, approve access to the asset, approve handling exceptions, and authorise disposal.',
    competencies: ['Understanding of the business value and sensitivity of the asset', 'Information classification scheme', 'Asset lifecycle and disposal requirements'],
    interfaces: [
      { role: 'IT Manager', nature: 'Agrees the protection and maintenance applied to the asset.' },
      { role: 'Cybersecurity GRC Manager', nature: 'Attests inventory accuracy and classification.' },
      { role: 'Information Custodian', nature: 'Directs day-to-day handling of the asset.' }
    ],
    responsibilities: [
      'Maintain accurate registration of owned assets in the inventory.',
      'Assign and review the classification of owned assets.',
      'Approve access to owned assets and recertify it on the defined cycle.',
      'Approve retention, archiving and secure disposal decisions.',
      'Attest inventory accuracy at each review cycle.'
    ],
    accountabilities: [
      'Accountable for the correctness of the classification assigned to owned assets.',
      'Accountable for access decisions relating to owned assets.',
      'Accountable for secure disposal being performed and evidenced.'
    ],
    activities: ['Review the asset register entry on change and at each attestation cycle.', 'Participate in access recertification for owned assets.', 'Authorise disposal and confirm sanitisation evidence.'],
    approvals: ['Asset classification.', 'Access to owned assets.', 'Asset disposal and data destruction.'],
    escalations: ['Escalate assets that cannot be classified to the Cybersecurity GRC Manager.', 'Escalate suspected loss or unauthorised disclosure to the Incident Management process.'],
    domains: ['asset_management', 'data_protection']
  },
  {
    code: 'system_owner', name: 'System Owner', shortName: 'System Owner', category: 'Technology',
    purpose: 'To be accountable for the secure operation of an information system throughout its lifecycle, including its control implementation, vulnerability remediation and recovery capability.',
    reportingLine: 'Reports within the technology or business function operating the system.',
    authority: 'Authorised to approve access to the system, approve changes to it, accept operational risk within the delegated appetite, and authorise recovery invocation for the system.',
    competencies: ['Technical understanding of the system and its dependencies', 'Security control implementation', 'Change and vulnerability management processes', 'Recovery planning'],
    interfaces: [
      { role: 'Business Owner', nature: 'Agrees service levels, recovery objectives and access decisions.' },
      { role: 'IT Manager', nature: 'Coordinates operational support and remediation delivery.' },
      { role: 'Vulnerability Management Specialist', nature: 'Receives and remediates assigned findings.' }
    ],
    responsibilities: [
      'Ensure required security controls are implemented and operating on the system.',
      'Approve access requests to the system and participate in recertification.',
      'Remediate assigned vulnerabilities within the applicable service levels.',
      'Maintain the system recovery plan and support recovery testing.',
      'Ensure logging is enabled and forwarded to the central platform.'
    ],
    accountabilities: [
      'Accountable for the security posture of the owned system.',
      'Accountable for vulnerability remediation within service levels on that system.',
      'Accountable for recovery capability meeting the agreed objectives.'
    ],
    activities: ['Review and approve access requests.', 'Participate in change advisory review for the system.', 'Execute or coordinate remediation of findings.', 'Support recovery testing on the defined cycle.'],
    approvals: ['Access to the owned system.', 'Changes to the owned system.', 'Restoration of the system to service after incident or recovery.'],
    escalations: ['Escalate vulnerabilities that cannot be remediated within the service level for formal exception.', 'Escalate control implementation that is not technically feasible to the Security Architect.', 'Escalate suspected compromise immediately to the Incident Management process.'],
    domains: ['vulnerability_management', 'change_management', 'disaster_recovery', 'iam']
  },
  {
    code: 'business_owner', name: 'Business Owner', shortName: 'Business Owner', category: 'Business',
    purpose: 'To be accountable for the business service that an information system supports, including the value of the information it holds, who may access it, and how quickly it must be recovered.',
    reportingLine: 'Reports within the business function that owns the service.',
    authority: 'Authorised to define business recovery objectives, approve user access on business need, accept business risk within the delegated appetite, and approve data sharing outside the organisation.',
    competencies: ['Understanding of the business process and its information', 'Business impact analysis', 'Risk acceptance within delegated authority', 'Regulatory obligations applying to the service'],
    interfaces: [
      { role: 'System Owner', nature: 'Agrees the security and recovery capability required of the system.' },
      { role: 'Risk Manager', nature: 'Owns business risk arising from the service.' },
      { role: 'Cybersecurity GRC Manager', nature: 'Provides evidence for access review and compliance.' }
    ],
    responsibilities: [
      'Define the criticality and recovery objectives of the business service.',
      'Approve user access on the basis of business need.',
      'Own and decide on cybersecurity risk arising from the service.',
      'Approve sharing of service information outside {{orgName}}.',
      'Participate in access recertification and business continuity exercising.'
    ],
    accountabilities: [
      'Accountable for access decisions on the business service.',
      'Accountable for the accuracy of the business impact analysis for the service.',
      'Accountable for business risk accepted in relation to the service.'
    ],
    activities: ['Complete the business impact analysis on the defined cycle.', 'Recertify user access each cycle.', 'Participate in continuity exercises for the service.'],
    approvals: ['User access to the business service.', 'External data sharing.', 'Business risk acceptance within delegated authority.', 'Supplier engagement for the service.'],
    escalations: ['Escalate risk above delegated authority to the Risk Manager and CISO.', 'Escalate recovery objectives that cannot be met by the available capability to the Steering Committee.'],
    domains: ['business_continuity', 'data_protection', 'third_party', 'iam']
  },
  {
    code: 'it_manager', name: 'IT Manager', shortName: 'IT Manager', category: 'Technology',
    purpose: 'To deliver and operate the technology environment in line with {{orgName}} security requirements, implementing the controls specified by the cybersecurity function.',
    reportingLine: 'Reports to the Chief Information Officer or equivalent technology leadership.',
    authority: 'Authorised to implement approved changes, approve standard changes at the change advisory board, authorise emergency change, and direct technical remediation activity.',
    competencies: ['Infrastructure and platform operations', 'Change and configuration management', 'Security control implementation', 'Backup and recovery operations'],
    interfaces: [
      { role: 'CISO', nature: 'Agrees control implementation priorities and remediation commitments.' },
      { role: 'System Owner', nature: 'Delivers operational support and remediation for owned systems.' },
      { role: 'IAM Specialist', nature: 'Supports provisioning and directory operations.' }
    ],
    responsibilities: [
      'Implement and maintain security controls across the technology estate.',
      'Operate change management including security assessment routing and back-out planning.',
      'Deploy and maintain endpoint protection, logging agents and configuration baselines.',
      'Operate backup and recovery and execute restoration testing.',
      'Support incident containment and recovery under the direction of the incident manager.'
    ],
    accountabilities: [
      'Accountable for the operational effectiveness of implemented technical controls.',
      'Accountable for change execution within approved windows with verified back-out capability.',
      'Accountable for backup job success and restoration test execution.'
    ],
    activities: ['Chair the change advisory board.', 'Deploy patches within the applicable service levels.', 'Monitor security tooling health and availability.', 'Execute recovery testing on the defined cycle.'],
    approvals: ['Standard and normal changes at the change advisory board.', 'Emergency change authorisation.', 'Technical implementation approach for approved controls.'],
    escalations: ['Escalate controls that cannot be implemented as specified to the Security Architect and CISO.', 'Escalate degraded security tooling as an operational incident.', 'Escalate repeated backup failures to the System Owner and Cybersecurity GRC Manager.'],
    domains: ['change_management', 'endpoint_security', 'network_security', 'backup_recovery']
  },
  {
    code: 'internal_auditor', name: 'Internal Auditor', shortName: 'Internal Audit', category: 'Assurance',
    purpose: 'To provide independent assurance to the board and audit committee over the design and operating effectiveness of cybersecurity controls.',
    reportingLine: 'Reports to the Audit Committee, independent of both the cybersecurity and technology functions.',
    authority: 'Authorised to access records, systems and personnel necessary to conduct audit work, to raise findings with mandatory management response, and to report directly to the Audit Committee.',
    competencies: ['Audit methodology and evidence standards', 'Cybersecurity control frameworks', 'Sampling and testing technique', 'Independent reporting to governance bodies'],
    interfaces: [
      { role: 'Audit Committee', nature: 'Reports audit results and management response.' },
      { role: 'Cybersecurity GRC Manager', nature: 'Requests evidence and agrees finding remediation.' },
      { role: 'CISO', nature: 'Discusses findings and management action plans.' }
    ],
    responsibilities: [
      'Plan and execute independent audits of cybersecurity controls on a risk-based schedule.',
      'Test control design and operating effectiveness against the applicable framework.',
      'Raise findings with risk ratings, agreed owners and due dates.',
      'Verify closure of previously raised findings before marking them complete.',
      'Report audit results and unresolved findings to the Audit Committee.'
    ],
    accountabilities: [
      'Accountable for the independence and objectivity of audit conclusions.',
      'Accountable for the sufficiency of evidence supporting each finding.',
      'Accountable for verifying finding closure rather than accepting assertion.'
    ],
    activities: ['Execute the annual cybersecurity audit plan.', 'Sample and test control evidence.', 'Track findings through to verified closure.', 'Report to the Audit Committee on the agreed cycle.'],
    approvals: ['Audit finding closure following verification.', 'Audit scope and plan, subject to Audit Committee endorsement.'],
    escalations: ['Escalate findings not remediated by their due date to the Audit Committee.', 'Escalate any restriction of audit access to the Audit Committee immediately.', 'Escalate evidence of material control failure to the Audit Committee and CISO.'],
    domains: ['governance', 'risk_management']
  }
];

export const ROLE_INDEX = Object.fromEntries(ROLE_LIBRARY.map((r) => [r.code, r]));

export function roleName(code) {
  return ROLE_INDEX[code]?.name || code;
}

export function roleShort(code) {
  return ROLE_INDEX[code]?.shortName || ROLE_INDEX[code]?.name || code;
}
