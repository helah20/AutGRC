/**
 * Canonical requirement models — access domains.
 * See domains.js for the shape contract. Every `refs` entry points at an
 * authoritative source requirement; the generator uses it to build the
 * traceability chain and never to invent new regulatory text.
 */

export const ACCESS_DOMAINS = {
  iam: {
    objectives: [
      'Ensure that every identity operating in the environment is uniquely attributable to an accountable person, service or device.',
      'Ensure that access is granted on the basis of Need-to-Know, Need-to-Use, Least Privilege and Segregation of Duties.',
      'Ensure that access rights are authorised before provisioning, reviewed on a defined cycle and revoked promptly when no longer required.',
      'Ensure that authentication strength is commensurate with the classification of the information and the risk of the access path.'
    ],
    parameters: {
      accessReviewFrequency: 'quarterly',
      privAccessReviewFrequency: 'quarterly',
      passwordMinLength: '14 characters',
      passwordHistory: '12 previous passwords',
      accountLockoutThreshold: '5 consecutive failed attempts',
      accountLockoutDuration: '30 minutes',
      revocationSla: '4 hours of the effective leaving or transfer time',
      dormantAccountThreshold: '90 days',
      provisioningSla: '3 business days',
      mfaMethods: 'a hardware or software one-time-password authenticator, or a FIDO2 security key',
      sessionIdleTimeout: '15 minutes',
      accessRecertCompletionTarget: '100% of in-scope accounts within 15 working days of cycle start',
      mfaCoverageTarget: '100%',
      serviceAccountReviewFrequency: 'semi-annually'
    },
    requirements: [
      {
        key: 'unique_identity',
        title: 'Unique identification of all users',
        policy: 'Every user, administrator, contractor, service and device requiring access to {{orgName}} information systems shall be issued a unique identifier. Shared, generic and anonymous accounts are prohibited unless formally approved as an exception under this Policy.',
        standard: 'Each identity shall be provisioned from the authoritative identity source (HR system for employees, contract register for third parties, CMDB for devices and services). Account naming shall follow the approved convention and shall not be re-issued to a different individual. Where a shared account is technically unavoidable, an approved exception shall record the compensating control that re-establishes individual attribution, such as privileged session brokering.',
        guidance: 'Integrate the HR joiner feed with the identity provider so identity creation is event-driven rather than ticket-driven. Reconcile the directory against HR and the contract register monthly to detect orphaned identities.',
        controlName: 'Unique user identification',
        controlType: 'preventive',
        controlNature: 'administrative',
        frequency: 'Continuous, with monthly reconciliation',
        kpi: 'Number of active shared accounts without an approved exception (target: 0)',
        risk: 'Actions cannot be attributed to an individual, defeating accountability and undermining investigation and disciplinary processes.',
        riskRating: 'high',
        evidence: [
          'Directory export of all active accounts with owner attribution',
          'Monthly HR-to-directory reconciliation report',
          'Register of approved shared-account exceptions with compensating controls'
        ],
        refs: { 'NCA-ECC': ['2-2-1', '2-2-3-1'], 'ISO-27001': ['A.5.16'], 'NIST-CSF': ['PR.AA-01'], 'NIST-800-53': ['IA-2'], 'CIS-V8': ['5.1'], 'SAMA-CSF': ['3.5'] }
      },
      {
        key: 'access_authorisation',
        title: 'Authorisation before provisioning',
        policy: 'Access to information systems shall be granted only after documented authorisation by the relevant Business Owner or System Owner. Access shall be granted on the principles of Need-to-Know, Need-to-Use, Least Privilege and Segregation of Duties.',
        standard: 'Every access request shall record the requester, the beneficiary, the target system, the role or entitlement requested, the business justification and the authorising owner. Requests shall be fulfilled within {{provisioningSla}} of approval. Entitlements shall be granted through role-based access control groups; direct assignment of permissions to individual accounts shall be prohibited except under an approved exception.',
        guidance: 'Publish a role-to-entitlement catalogue so requesters select a business role rather than a technical permission. Configure the ITSM workflow to route approvals to the system owner recorded in the CMDB.',
        controlName: 'Documented access authorisation',
        controlType: 'preventive',
        controlNature: 'administrative',
        frequency: 'Per request',
        kpi: '% of access grants with a recorded approval prior to provisioning (target: 100%)',
        risk: 'Unauthorised or excessive access is granted, enabling data exposure, fraud or sabotage.',
        riskRating: 'high',
        evidence: [
          'Access request and approval records from the ITSM system',
          'Role-to-entitlement catalogue (current version)',
          'Sample reconciliation of granted entitlements against approvals'
        ],
        refs: { 'NCA-ECC': ['2-2-3-3'], 'ISO-27001': ['A.5.15', 'A.5.18', 'A.8.3'], 'NIST-CSF': ['PR.AA-05'], 'NIST-800-53': ['AC-3', 'AC-6'], 'CIS-V8': ['6.8'], 'SAMA-CSF': ['3.5'] }
      },
      {
        key: 'segregation_of_duties',
        title: 'Segregation of duties',
        policy: 'Conflicting duties and areas of responsibility shall be segregated to reduce the opportunity for unauthorised or unintentional modification or misuse of {{orgName}} assets.',
        standard: 'A segregation-of-duties conflict matrix shall be maintained for each in-scope business application, identifying toxic entitlement combinations. Access requests shall be evaluated against the matrix before approval, and detected conflicts shall be either prevented or accepted through a documented exception with a compensating detective control.',
        guidance: 'Start with the highest-risk financial and privileged combinations rather than attempting complete coverage on day one. Automate conflict detection in the request workflow where the application supports it.',
        controlName: 'Segregation of duties conflict management',
        controlType: 'preventive',
        controlNature: 'administrative',
        frequency: 'Per request, with {{accessReviewFrequency}} matrix validation',
        kpi: 'Number of unmitigated segregation-of-duties conflicts in production (target: 0)',
        risk: 'A single individual can initiate and approve a sensitive transaction, enabling fraud that no single control would detect.',
        riskRating: 'high',
        evidence: [
          'Segregation-of-duties conflict matrix per application',
          'Conflict detection report from the last review cycle',
          'Approved exceptions with documented compensating controls'
        ],
        refs: { 'NCA-ECC': ['2-2-3-3'], 'ISO-27001': ['A.5.3'], 'NIST-800-53': ['AC-5'], 'NIST-CSF': ['PR.AA-05'] }
      },
      {
        key: 'mfa_privileged',
        title: 'Multi-factor authentication for privileged and remote access',
        policy: 'Privileged access, remote access and access to systems processing Confidential or higher classified information shall be protected using multi-factor authentication.',
        standard: 'Multi-factor authentication shall be enforced using {{mfaMethods}}. SMS and voice-call factors shall not be used for privileged access. MFA shall be enforced at the identity provider so that it cannot be bypassed by a direct application login, and enrolment shall require identity proofing. Coverage shall reach {{mfaCoverageTarget}} of privileged and remote-access accounts.',
        guidance: 'Enforce MFA through conditional access policies at the identity provider rather than per application. Maintain a documented break-glass path with offline credentials, alerting on every use.',
        controlName: 'Multi-factor authentication for privileged and remote access',
        controlType: 'preventive',
        controlNature: 'technical',
        frequency: 'Continuous',
        kpi: '% of privileged and remote-access accounts enrolled in MFA (target: {{mfaCoverageTarget}})',
        risk: 'A stolen or phished password grants an attacker full administrative control, which is the most common path to ransomware and large-scale data theft.',
        riskRating: 'critical',
        evidence: [
          'MFA configuration export from the identity provider',
          'Conditional access policy definitions covering privileged and remote access',
          'MFA enrolment report reconciled to the privileged account inventory',
          'Break-glass account usage alerts for the reporting period'
        ],
        refs: { 'NCA-ECC': ['2-2-3-2', '2-2-3-4'], 'ISO-27001': ['A.8.5', 'A.8.2'], 'NIST-CSF': ['PR.AA-03'], 'NIST-800-53': ['IA-2', 'AC-17'], 'CIS-V8': ['6.3', '6.5'], 'SAMA-CSF': ['3.5'] }
      },
      {
        key: 'authentication_credentials',
        title: 'Management of authentication credentials',
        policy: 'Authentication credentials shall be issued, stored, transmitted and revoked in a manner that protects them from disclosure and unauthorised use throughout their lifecycle.',
        standard: 'Passwords shall be a minimum of {{passwordMinLength}}, shall be screened against a breached-password corpus, and shall not be reusable within {{passwordHistory}}. Accounts shall lock after {{accountLockoutThreshold}} for {{accountLockoutDuration}}. Credentials shall be stored using a salted, computationally hard one-way function and shall never be transmitted or stored in clear text. Initial and reset credentials shall be single-use and shall require change on first use.',
        guidance: 'Prefer length and breach screening over forced periodic rotation, which drives predictable password patterns. Where a regulator mandates rotation, record that mandate as the basis for the exception to this guidance.',
        controlName: 'Authentication credential management',
        controlType: 'preventive',
        controlNature: 'technical',
        frequency: 'Continuous',
        kpi: '% of in-scope directories enforcing the approved password policy (target: 100%)',
        risk: 'Weak or reused credentials are guessed or replayed from prior breaches, granting an attacker authenticated access.',
        riskRating: 'high',
        evidence: [
          'Password policy configuration export per directory and application',
          'Breached-password screening service configuration',
          'Account lockout configuration evidence'
        ],
        refs: { 'NCA-ECC': ['2-2-3-1'], 'ISO-27001': ['A.5.17', 'A.8.5'], 'NIST-800-53': ['IA-5'], 'NIST-CSF': ['PR.AA-01'] }
      },
      {
        key: 'joiner_mover_leaver',
        title: 'Joiner, mover and leaver processing',
        policy: 'Access rights shall be created, amended and revoked in line with changes to employment or engagement status. Access shall be revoked promptly upon termination or transfer.',
        standard: 'On termination or transfer, all access shall be disabled within {{revocationSla}}. Movers shall have entitlements from the previous role removed at the same time new entitlements are granted; additive-only transfers are prohibited. Leaver processing shall cover the directory, business applications, privileged vaults, remote access, cloud tenancies and physical access.',
        guidance: 'Drive revocation from the HR termination event rather than a manager-raised ticket. Run a weekly exception report comparing terminated employees against still-enabled accounts.',
        controlName: 'Joiner, mover and leaver access processing',
        controlType: 'preventive',
        controlNature: 'administrative',
        frequency: 'Per event, with weekly exception reporting',
        kpi: '% of leavers with all access revoked within {{revocationSla}} (target: 100%)',
        risk: 'Departed staff or transferred employees retain access, creating an unmonitored path into systems and accumulating excessive privilege.',
        riskRating: 'high',
        evidence: [
          'Leaver revocation records with timestamps against HR termination dates',
          'Weekly terminated-but-enabled exception report',
          'Sample of mover records showing removal of prior entitlements'
        ],
        refs: { 'NCA-ECC': ['2-2-3-5', '1-9'], 'ISO-27001': ['A.5.18', 'A.6.5'], 'NIST-800-53': ['AC-2'], 'CIS-V8': ['5.1'], 'SAMA-CSF': ['3.1'] }
      },
      {
        key: 'access_review',
        title: 'Periodic review of identities and access rights',
        policy: 'User identities and access rights shall be reviewed at least {{accessReviewFrequency}}, and privileged access rights at least {{privAccessReviewFrequency}}, by the accountable Business or System Owner.',
        standard: 'Each review cycle shall present the reviewer with the account, the entitlements held, the last logon date and the business justification. Reviewers shall certify, revoke or modify each entitlement; a non-response shall not be recorded as certification. Revocations arising from a review shall be actioned within {{provisioningSla}}. Cycles shall reach {{accessRecertCompletionTarget}}. Service and non-human accounts shall be reviewed at least {{serviceAccountReviewFrequency}}.',
        guidance: 'Give reviewers usage data alongside entitlements; unused entitlements are the easiest legitimate revocation and build reviewer confidence. Track revocation closure separately from certification completion — an uncompleted revocation is an open finding.',
        controlName: 'Periodic access recertification',
        controlType: 'detective',
        controlNature: 'administrative',
        frequency: '{{accessReviewFrequency}} (privileged: {{privAccessReviewFrequency}})',
        kpi: '% of accounts recertified within the cycle window (target: {{accessRecertCompletionTarget}})',
        risk: 'Privilege accumulates silently as people change roles, so the population with access to sensitive data no longer matches the population that needs it.',
        riskRating: 'high',
        evidence: [
          'Access review campaign report showing scope, reviewers and decisions',
          'Evidence of revocations actioned following the review',
          'Sign-off from each accountable owner for the completed cycle',
          'Privileged account review records for the cycle'
        ],
        refs: { 'NCA-ECC': ['2-2-3-5', '2-2-4'], 'ISO-27001': ['A.5.18'], 'NIST-800-53': ['AC-2'], 'NIST-CSF': ['PR.AA-05'], 'CIS-V8': ['5.1'], 'SAMA-CSF': ['3.5'] }
      },
      {
        key: 'dormant_accounts',
        title: 'Dormant and orphaned account management',
        policy: 'Accounts that are no longer in active use shall be identified and disabled.',
        standard: 'Accounts with no successful authentication for {{dormantAccountThreshold}} shall be automatically disabled and the owner notified. Disabled accounts shall be deleted or archived after a further 90 days unless retained for a documented legal, investigative or regulatory purpose.',
        guidance: 'Exclude documented break-glass and disaster-recovery accounts from automatic disablement, but compensate with alerting on their use.',
        controlName: 'Dormant account disablement',
        controlType: 'detective',
        controlNature: 'technical',
        frequency: 'Monthly',
        kpi: 'Number of enabled accounts dormant beyond {{dormantAccountThreshold}} (target: 0)',
        risk: 'Unused accounts remain valid credentials that nobody is watching, making them attractive targets for takeover.',
        riskRating: 'medium',
        evidence: [
          'Dormant account report with last logon timestamps',
          'Evidence of automated disablement actions',
          'Register of accounts excluded from dormancy processing with justification'
        ],
        refs: { 'NCA-ECC': ['2-2-3-5'], 'ISO-27001': ['A.5.18'], 'NIST-800-53': ['AC-2'], 'CIS-V8': ['5.1'] }
      },
      {
        key: 'service_accounts',
        title: 'Service and non-human account control',
        policy: 'Service, application and machine identities shall have a named human owner and shall be managed with the same rigour as human identities.',
        standard: 'Every service account shall be registered with a named owner, a documented purpose, the systems it accesses and its credential rotation method. Service accounts shall be prohibited from interactive logon, shall not be granted privileges beyond those required, and shall use managed or vaulted credentials where the platform supports it. Ownership and entitlements shall be reviewed {{serviceAccountReviewFrequency}}.',
        guidance: 'Migrate to platform-managed identities (managed service accounts, workload identity federation) before attempting to solve credential rotation with scripts.',
        controlName: 'Service account governance',
        controlType: 'preventive',
        controlNature: 'hybrid',
        frequency: 'Continuous, reviewed {{serviceAccountReviewFrequency}}',
        kpi: '% of service accounts with a named owner and registered purpose (target: 100%)',
        risk: 'Long-lived, over-privileged service credentials embedded in scripts provide a persistent and poorly monitored attack path.',
        riskRating: 'high',
        evidence: [
          'Service account register with owners and purposes',
          'Evidence of interactive logon denial for service accounts',
          'Credential rotation records or managed-identity configuration'
        ],
        refs: { 'NCA-ECC': ['2-2-3-3'], 'ISO-27001': ['A.5.16', 'A.8.2'], 'NIST-800-53': ['AC-2', 'IA-5'], 'CIS-V8': ['5.1'] }
      },
      {
        key: 'session_management',
        title: 'Session management',
        policy: 'Authenticated sessions shall be terminated after a defined period of inactivity and upon logout.',
        standard: 'Interactive sessions shall lock or terminate after {{sessionIdleTimeout}} of inactivity. Session identifiers shall be regenerated on authentication and invalidated server-side on logout. Concurrent session limits shall be applied to privileged accounts.',
        guidance: 'Apply a shorter idle timeout to administrative consoles than to standard desktop sessions, and document the difference so it does not read as an inconsistency.',
        controlName: 'Session timeout and termination',
        controlType: 'preventive',
        controlNature: 'technical',
        frequency: 'Continuous',
        kpi: '% of in-scope applications enforcing the approved session timeout (target: 100%)',
        risk: 'An unattended authenticated session is used by another party, bypassing all authentication controls.',
        riskRating: 'medium',
        evidence: [
          'Session timeout configuration per system',
          'Screen lock policy applied via endpoint management'
        ],
        refs: { 'ISO-27001': ['A.8.5', 'A.7.7'], 'NIST-800-53': ['AC-3'], 'NCA-ECC': ['2-2-2'] }
      },
      {
        key: 'third_party_access',
        title: 'Third-party and remote access control',
        policy: 'Access granted to third parties shall be time-bound, least-privileged, individually attributable and monitored for the duration of the engagement.',
        standard: 'Third-party access shall be approved by the relevant System Owner and the engagement sponsor, shall carry an expiry date not exceeding the contract end date, and shall be provisioned through the approved remote access gateway. Third-party privileged sessions shall be brokered and recorded. Access shall be revoked within {{revocationSla}} of engagement completion.',
        guidance: 'Default the expiry date to the shortest credible engagement window and require re-approval to extend; permanent third-party accounts accumulate faster than any review cycle removes them.',
        controlName: 'Third-party access control',
        controlType: 'preventive',
        controlNature: 'hybrid',
        frequency: 'Per engagement, reviewed {{accessReviewFrequency}}',
        kpi: '% of third-party accounts with an expiry date not exceeding contract end (target: 100%)',
        risk: 'Supplier accounts persist beyond the engagement and are compromised, providing an attacker with trusted network access.',
        riskRating: 'high',
        evidence: [
          'Third-party account register with expiry dates and sponsors',
          'Remote access gateway logs for third-party sessions',
          'Privileged session recordings for third-party administrative access'
        ],
        refs: { 'NCA-ECC': ['2-2-3-2', '4-1-1'], 'ISO-27001': ['A.5.19', 'A.8.2'], 'NIST-800-53': ['AC-17'], 'NCA-TCC': ['2-1'] }
      },
      {
        key: 'iam_logging',
        title: 'Logging of identity and access events',
        policy: 'Identity and access management events shall be logged, protected from alteration and monitored for anomalous activity.',
        standard: 'Authentication successes and failures, account creation, modification and deletion, privilege changes, group membership changes and access review decisions shall be logged with a timestamp, source and actor. Logs shall be forwarded to the central log platform and retained in line with the Logging and Monitoring Standard.',
        guidance: 'Ensure directory audit logging is enabled at the level that records group membership changes — the default configuration on several platforms does not.',
        controlName: 'Identity and access event logging',
        controlType: 'detective',
        controlNature: 'technical',
        frequency: 'Continuous',
        kpi: '% of identity systems forwarding audit logs to the central platform (target: 100%)',
        risk: 'Account takeover and privilege escalation proceed undetected because the events that would reveal them are not recorded.',
        riskRating: 'high',
        evidence: [
          'Log source inventory showing identity systems onboarded',
          'Sample audit log extract showing privilege change events',
          'Detection use cases covering anomalous authentication'
        ],
        refs: { 'NCA-ECC': ['2-12-3'], 'ISO-27001': ['A.8.15'], 'NIST-800-53': ['AU-2'], 'CIS-V8': ['8.2'], 'NIST-CSF': ['PR.PS-04'] }
      }
    ],
    procedure: {
      purpose: 'To define the end-to-end process for requesting, approving, provisioning, reviewing and revoking access to {{orgName}} information systems.',
      preconditions: [
        'The requester holds a valid, unique identity in the corporate directory.',
        'The target system is registered in the CMDB with a named System Owner.',
        'The role-to-entitlement catalogue contains the requested business role.',
        'For third-party requests, a signed contract and non-disclosure agreement are in force.'
      ],
      inputs: [
        'Access request submitted through the ITSM system',
        'Business justification and required duration',
        'Segregation-of-duties conflict matrix for the target application',
        'HR joiner, mover or leaver notification (for lifecycle-driven requests)'
      ],
      steps: [
        { name: 'Request', actor: 'Requester / Line Manager', detail: 'Submit an access request recording the beneficiary, target system, business role required, justification and required duration. Requests for privileged entitlements shall be flagged as privileged at submission.' },
        { name: 'Validate', actor: 'IAM Specialist', detail: 'Confirm the beneficiary holds a unique identity, the target system is registered, and the requested role exists in the entitlement catalogue. Screen the request against the segregation-of-duties conflict matrix.', decision: { question: 'Does the request create a segregation-of-duties conflict?', yes: 'Route to Risk Manager for compensating control or rejection', no: 'Continue to Approval' } },
        { name: 'Approve', actor: 'Business Owner / System Owner', detail: 'Review the justification and approve, reject or amend the request. Privileged access requests additionally require Cybersecurity GRC Manager endorsement.', decision: { question: 'Is the request approved?', yes: 'Continue to Provisioning', no: 'Close the request with a recorded rejection reason and notify the requester' } },
        { name: 'Provision', actor: 'IAM Specialist', detail: 'Grant the entitlement through the approved role-based group within {{provisioningSla}} of approval. Configure MFA enrolment where the entitlement is privileged or remote. Record the provisioning action against the request.' },
        { name: 'Verify', actor: 'IAM Specialist', detail: 'Confirm that the entitlement granted matches the entitlement approved, that no additional permissions were applied, and that the account is subject to the approved authentication policy.', decision: { question: 'Does the granted access match the approval?', yes: 'Notify the requester and close', no: 'Remediate the discrepancy and record a control exception' } },
        { name: 'Review', actor: 'Business Owner / System Owner', detail: 'Recertify the entitlement during the {{accessReviewFrequency}} access review cycle, or {{privAccessReviewFrequency}} where the entitlement is privileged. Certify, modify or revoke each entitlement held.' },
        { name: 'Revoke', actor: 'IAM Specialist', detail: 'Remove access upon revocation decision, engagement completion, transfer or termination, within {{revocationSla}}. Confirm removal across the directory, business applications, privileged vault, remote access and cloud tenancies.' },
        { name: 'Close', actor: 'Cybersecurity GRC Manager', detail: 'Confirm that the request record, approval, provisioning evidence and (where applicable) revocation evidence are complete and retained for audit.' }
      ],
      outputs: [
        'Provisioned or revoked access rights matching the approved entitlement',
        'Completed access request record with approval trail',
        'Updated entitlement position for the next access review cycle'
      ],
      escalation: [
        'Requests unapproved after 5 business days escalate to the System Owner\'s line manager.',
        'Segregation-of-duties conflicts that cannot be mitigated escalate to the Risk Manager and, where accepted, to the Cybersecurity Steering Committee.',
        'Revocation not completed within {{revocationSla}} escalates immediately to the Cybersecurity GRC Manager and is recorded as a control failure.',
        'Suspected misuse of granted access escalates to the Incident Management process without delay.'
      ],
      records: [
        'Access request and approval record (retained 3 years)',
        'Provisioning and revocation logs (retained per the Logging and Monitoring Standard)',
        'Access review campaign results and owner sign-off (retained 3 years)',
        'Segregation-of-duties conflict decisions and exceptions (retained 3 years)'
      ],
      kpis: [
        { name: 'Provisioning timeliness', target: '95% of approved requests fulfilled within {{provisioningSla}}' },
        { name: 'Revocation timeliness', target: '100% of leaver revocations within {{revocationSla}}' },
        { name: 'Access review completion', target: '{{accessRecertCompletionTarget}}' },
        { name: 'MFA coverage for privileged accounts', target: '{{mfaCoverageTarget}}' },
        { name: 'Unauthorised provisioning events', target: '0 per quarter' }
      ]
    },
    roles: ['ciso', 'grc_manager', 'iam_specialist', 'it_manager', 'system_owner', 'business_owner', 'internal_auditor', 'risk_manager'],
    raciActivities: [
      { activity: 'Define and approve the IAM Policy', phase: 'Govern', assign: { ciso: 'A', grc_manager: 'R', iam_specialist: 'C', it_manager: 'C', system_owner: 'I', business_owner: 'I', internal_auditor: 'I', risk_manager: 'C' } },
      { activity: 'Maintain the role-to-entitlement catalogue', phase: 'Govern', assign: { ciso: 'I', grc_manager: 'A', iam_specialist: 'R', it_manager: 'C', system_owner: 'C', business_owner: 'C', internal_auditor: 'I', risk_manager: 'I' } },
      { activity: 'Raise and justify an access request', phase: 'Operate', assign: { ciso: 'I', grc_manager: 'A', iam_specialist: 'C', it_manager: 'I', system_owner: 'C', business_owner: 'R', internal_auditor: 'I', risk_manager: 'I' } },
      { activity: 'Approve standard access requests', phase: 'Operate', assign: { ciso: 'I', grc_manager: 'I', iam_specialist: 'C', it_manager: 'I', system_owner: 'A', business_owner: 'R', internal_auditor: 'I', risk_manager: 'I' } },
      { activity: 'Approve privileged access requests', phase: 'Operate', assign: { ciso: 'A', grc_manager: 'R', iam_specialist: 'C', it_manager: 'C', system_owner: 'R', business_owner: 'I', internal_auditor: 'I', risk_manager: 'C' } },
      { activity: 'Provision and verify access', phase: 'Operate', assign: { ciso: 'I', grc_manager: 'I', iam_specialist: 'R', it_manager: 'A', system_owner: 'C', business_owner: 'I', internal_auditor: 'I', risk_manager: 'I' } },
      { activity: 'Enforce multi-factor authentication', phase: 'Protect', assign: { ciso: 'A', grc_manager: 'C', iam_specialist: 'R', it_manager: 'R', system_owner: 'C', business_owner: 'I', internal_auditor: 'I', risk_manager: 'I' } },
      { activity: 'Screen requests against segregation-of-duties conflicts', phase: 'Operate', assign: { ciso: 'I', grc_manager: 'A', iam_specialist: 'R', it_manager: 'I', system_owner: 'C', business_owner: 'C', internal_auditor: 'I', risk_manager: 'C' } },
      { activity: 'Conduct periodic access review', phase: 'Assure', assign: { ciso: 'I', grc_manager: 'A', iam_specialist: 'R', it_manager: 'C', system_owner: 'R', business_owner: 'R', internal_auditor: 'C', risk_manager: 'I' } },
      { activity: 'Revoke access on termination or transfer', phase: 'Operate', assign: { ciso: 'I', grc_manager: 'C', iam_specialist: 'R', it_manager: 'A', system_owner: 'I', business_owner: 'C', internal_auditor: 'I', risk_manager: 'I' } },
      { activity: 'Review dormant and orphaned accounts', phase: 'Assure', assign: { ciso: 'I', grc_manager: 'A', iam_specialist: 'R', it_manager: 'C', system_owner: 'C', business_owner: 'I', internal_auditor: 'I', risk_manager: 'I' } },
      { activity: 'Audit IAM control effectiveness', phase: 'Assure', assign: { ciso: 'I', grc_manager: 'C', iam_specialist: 'C', it_manager: 'I', system_owner: 'I', business_owner: 'I', internal_auditor: 'R', risk_manager: 'A' } },
      { activity: 'Report IAM KPIs to the Cybersecurity Steering Committee', phase: 'Govern', assign: { ciso: 'A', grc_manager: 'R', iam_specialist: 'C', it_manager: 'I', system_owner: 'I', business_owner: 'I', internal_auditor: 'I', risk_manager: 'I' } }
    ]
  },

  pam: {
    objectives: [
      'Ensure that privileged access is granted only where a documented operational need exists, and only for the time that need persists.',
      'Ensure that every privileged session is individually attributable, brokered and recorded.',
      'Ensure that privileged credentials are never known to, or reusable by, an individual outside a controlled workflow.',
      'Ensure that privileged activity is monitored against a defined set of detection use cases.'
    ],
    parameters: {
      privAccessReviewFrequency: 'quarterly',
      jitMaxDuration: '8 hours',
      vaultRotationFrequency: 'after every use and at least every 30 days',
      sessionRecordingRetention: '12 months',
      breakGlassTestFrequency: 'semi-annually',
      privSessionTimeout: '15 minutes',
      emergencyAccessReviewSla: '1 business day'
    },
    requirements: [
      {
        key: 'priv_account_inventory',
        title: 'Inventory of privileged accounts',
        policy: 'A complete inventory of privileged accounts and entitlements shall be maintained across all platforms, applications, databases, network devices and cloud tenancies.',
        standard: 'The inventory shall record the account, the platform, the privilege level, the named human owner, the business justification and whether the account is vaulted. It shall be reconciled against the source platforms at least monthly, and newly discovered privileged accounts shall be onboarded to the privileged access management solution or formally exempted within 10 business days.',
        guidance: 'Automate discovery against the directory, cloud IAM, database engines and network devices; manual inventories drift within one change cycle.',
        controlName: 'Privileged account inventory and discovery',
        controlType: 'detective',
        controlNature: 'hybrid',
        frequency: 'Monthly reconciliation',
        kpi: '% of discovered privileged accounts onboarded or formally exempted (target: 100%)',
        risk: 'Unmanaged privileged accounts sit outside every control designed to protect privileged access.',
        riskRating: 'critical',
        evidence: [
          'Privileged account inventory with owners and vault status',
          'Monthly discovery reconciliation report',
          'Exemption register with justification and compensating controls'
        ],
        refs: { 'NCA-ECC': ['2-2-3-4'], 'ISO-27001': ['A.8.2'], 'NIST-800-53': ['AC-6'], 'CIS-V8': ['5.4'] }
      },
      {
        key: 'separate_admin_accounts',
        title: 'Separate accounts for administrative activity',
        policy: 'Administrative activity shall be performed using a dedicated privileged account, distinct from the individual\'s standard user account.',
        standard: 'Privileged accounts shall not be used for email, web browsing or routine productivity work, and shall be blocked from those services by policy. Administrative access to servers and management planes shall originate from a hardened privileged access workstation or an equivalent brokered session.',
        guidance: 'Block internet and mail access for privileged accounts at the identity provider; relying on user discipline alone reliably fails.',
        controlName: 'Dedicated administrative accounts',
        controlType: 'preventive',
        controlNature: 'technical',
        frequency: 'Continuous',
        kpi: '% of administrators holding a separate privileged account (target: 100%)',
        risk: 'A phishing email opened on a privileged account converts a routine compromise into immediate domain-wide control.',
        riskRating: 'critical',
        evidence: [
          'Directory export showing paired standard and privileged accounts',
          'Conditional access policy blocking mail and web for privileged accounts',
          'Privileged access workstation configuration baseline'
        ],
        refs: { 'NCA-ECC': ['2-2-3-4'], 'ISO-27001': ['A.8.2'], 'CIS-V8': ['5.4'], 'NIST-800-53': ['AC-6'] }
      },
      {
        key: 'credential_vaulting',
        title: 'Vaulting and rotation of privileged credentials',
        policy: 'Privileged credentials shall be held in an approved credential vault and shall not be known to, or retained by, individual users.',
        standard: 'Privileged credentials shall be checked out through the vault with a recorded justification, and shall be rotated {{vaultRotationFrequency}}. Local administrator passwords shall be unique per device and managed automatically. Embedded credentials in scripts, configuration files and application code shall be replaced with vault retrieval or platform-managed identities.',
        guidance: 'Prioritise domain administrative, hypervisor, backup and cloud root credentials for vaulting — these are the accounts that turn an intrusion into an enterprise-wide event.',
        controlName: 'Privileged credential vaulting and rotation',
        controlType: 'preventive',
        controlNature: 'technical',
        frequency: 'Continuous, rotation {{vaultRotationFrequency}}',
        kpi: '% of privileged credentials under vault management (target: 100%)',
        risk: 'A privileged password learned once remains valid indefinitely, surviving the departure of the person who learned it.',
        riskRating: 'critical',
        evidence: [
          'Vault inventory of managed privileged credentials',
          'Credential rotation logs for the reporting period',
          'Local administrator password management configuration',
          'Secrets scanning report over code repositories'
        ],
        refs: { 'NCA-ECC': ['2-2-3-4'], 'ISO-27001': ['A.8.2', 'A.5.17'], 'NIST-800-53': ['IA-5', 'AC-6'], 'SAMA-CSF': ['3.5'] }
      },
      {
        key: 'jit_elevation',
        title: 'Just-in-time privilege elevation',
        policy: 'Standing privileged access shall be minimised. Privileges shall be granted for the duration of the approved task and withdrawn automatically on completion.',
        standard: 'Privilege elevation requests shall record the task, the target system and the required duration, which shall not exceed {{jitMaxDuration}} without re-approval. Elevation shall expire automatically. Persistent privileged assignment shall require documented approval from the CISO and shall be reviewed {{privAccessReviewFrequency}}.',
        guidance: 'Start with the highest-impact roles (domain and cloud administrators) and expand; attempting to eliminate all standing privilege at once stalls on operational exceptions.',
        controlName: 'Just-in-time privilege elevation',
        controlType: 'preventive',
        controlNature: 'technical',
        frequency: 'Per elevation',
        kpi: '% of privileged role activations performed just-in-time rather than standing (target: 90%)',
        risk: 'Permanently assigned privilege is available to an attacker at any moment of compromise, not only during legitimate administrative work.',
        riskRating: 'high',
        evidence: [
          'Just-in-time elevation request and approval records',
          'Report of standing privileged assignments with CISO approval',
          'Evidence of automatic expiry of elevated roles'
        ],
        refs: { 'NCA-ECC': ['2-2-3-4'], 'ISO-27001': ['A.8.2'], 'NIST-800-53': ['AC-6'], 'CIS-V8': ['5.4'] }
      },
      {
        key: 'session_brokering',
        title: 'Brokering and recording of privileged sessions',
        policy: 'Privileged sessions to critical systems shall be established through an approved session broker and shall be recorded.',
        standard: 'Session recordings shall capture the operator identity, target system, start and end time and the commands or screen activity performed. Recordings shall be retained for {{sessionRecordingRetention}}, protected from modification by the operators they record, and shall be accessible to Internal Audit. Privileged sessions shall terminate after {{privSessionTimeout}} of inactivity.',
        guidance: 'Ensure the recording store is outside the administrative control of the administrators being recorded; otherwise the control cannot be relied upon in an investigation.',
        controlName: 'Privileged session brokering and recording',
        controlType: 'detective',
        controlNature: 'technical',
        frequency: 'Continuous',
        kpi: '% of privileged sessions to critical systems brokered and recorded (target: 100%)',
        risk: 'Privileged actions cannot be reconstructed after an incident, leaving both malicious activity and honest error unexplained.',
        riskRating: 'high',
        evidence: [
          'Session broker configuration and coverage report',
          'Sample privileged session recordings with retention metadata',
          'Access control configuration over the recording repository'
        ],
        refs: { 'NCA-ECC': ['2-2-3-4', '2-12-3'], 'ISO-27001': ['A.8.2', 'A.8.15'], 'NIST-800-53': ['AU-2', 'AC-6'] }
      },
      {
        key: 'break_glass',
        title: 'Emergency (break-glass) access',
        policy: 'Emergency access procedures shall exist for situations where normal privileged access paths are unavailable, and every use shall be authorised, alerted and reviewed.',
        standard: 'Break-glass accounts shall be excluded from conditional access dependencies that could render them unusable, shall be protected by credentials split between two custodians or held in a sealed vault, and shall generate an immediate alert to the CISO and Security Operations on use. Every use shall be reviewed within {{emergencyAccessReviewSla}}, and the credentials rotated immediately after use. Break-glass procedures shall be tested {{breakGlassTestFrequency}}.',
        guidance: 'Test the break-glass path on the assumption the identity provider itself is unavailable — that is the scenario in which it is needed.',
        controlName: 'Emergency privileged access management',
        controlType: 'corrective',
        controlNature: 'hybrid',
        frequency: 'Per use; tested {{breakGlassTestFrequency}}',
        kpi: '% of break-glass activations reviewed within {{emergencyAccessReviewSla}} (target: 100%)',
        risk: 'Either emergency access is unavailable during a crisis, or it exists as an unmonitored backdoor into every system.',
        riskRating: 'high',
        evidence: [
          'Break-glass account register and custodian assignment',
          'Alert configuration for break-glass usage',
          'Post-use review records and credential rotation evidence',
          'Break-glass test results for the period'
        ],
        refs: { 'NCA-ECC': ['2-2-3-4'], 'ISO-27001': ['A.8.2', 'A.5.29'], 'NIST-800-53': ['AC-6', 'CP-10'] }
      },
      {
        key: 'priv_access_review',
        title: 'Periodic review of privileged access',
        policy: 'Privileged access rights shall be reviewed at least {{privAccessReviewFrequency}} by the CISO and the accountable System Owner.',
        standard: 'The review shall cover every privileged account and entitlement in the inventory, including service accounts with privileged rights, cloud administrative roles and emergency accounts. Reviewers shall be presented with activation history alongside entitlements. Revocations shall be actioned within 2 business days of the review decision.',
        guidance: 'Review activation history rather than assignment alone; a privileged role never activated in a quarter is the clearest candidate for removal.',
        controlName: 'Privileged access recertification',
        controlType: 'detective',
        controlNature: 'administrative',
        frequency: '{{privAccessReviewFrequency}}',
        kpi: '% of privileged entitlements recertified within the cycle (target: 100%)',
        risk: 'Privileged entitlements granted for a project persist for years, expanding the population that can cause enterprise-wide damage.',
        riskRating: 'high',
        evidence: [
          'Privileged access review campaign report with decisions',
          'CISO and System Owner sign-off for the cycle',
          'Evidence of revocations completed after review'
        ],
        refs: { 'NCA-ECC': ['2-2-3-5', '2-2-4'], 'ISO-27001': ['A.5.18', 'A.8.2'], 'NIST-800-53': ['AC-2'], 'NIST-CSF': ['PR.AA-05'] }
      },
      {
        key: 'priv_monitoring',
        title: 'Monitoring of privileged activity',
        policy: 'Privileged activity shall be monitored continuously against defined detection use cases, and anomalies shall be investigated through the Incident Management process.',
        standard: 'Detection use cases shall cover, at minimum: privileged logon outside approved hours or locations, creation or modification of privileged group membership, use of break-glass accounts, disabling of security tooling or audit logging, and bulk data access by a privileged account. Alerts shall be triaged in line with the Incident Management Procedure.',
        guidance: 'Tune the use cases against the change calendar; privileged activity during an approved change window is expected and should not consume analyst time.',
        controlName: 'Privileged activity monitoring',
        controlType: 'detective',
        controlNature: 'technical',
        frequency: 'Continuous',
        kpi: 'Mean time to triage privileged-activity alerts (target: under 30 minutes)',
        risk: 'An attacker operating with valid privileged credentials is indistinguishable from an administrator unless behaviour is monitored.',
        riskRating: 'high',
        evidence: [
          'Detection use case definitions for privileged activity',
          'Alert triage records for the reporting period',
          'Evidence of audit-log tampering detection'
        ],
        refs: { 'NCA-ECC': ['2-12-3', '2-13-2'], 'ISO-27001': ['A.8.16', 'A.8.15'], 'NIST-800-53': ['AU-6', 'SI-4'], 'NIST-CSF': ['DE.CM-03'] }
      },
      {
        key: 'priv_utility_programs',
        title: 'Control of privileged utility programs',
        policy: 'The use of utility programs capable of overriding system and application controls shall be restricted and monitored.',
        standard: 'Privileged utilities shall be inventoried, removed where not required, and restricted to named privileged accounts. Execution shall be logged. Application allow-listing shall prevent the execution of unapproved administrative tooling on servers and privileged access workstations.',
        guidance: 'Include the dual-use tooling attackers favour — remote administration utilities, credential dumping tools and scripting engines — in the same inventory as vendor utilities.',
        controlName: 'Privileged utility program control',
        controlType: 'preventive',
        controlNature: 'technical',
        frequency: 'Continuous, reviewed {{privAccessReviewFrequency}}',
        kpi: '% of servers with application allow-listing enforced (target: 95%)',
        risk: 'Administrative utilities bypass application-level controls entirely, allowing direct manipulation of data and audit records.',
        riskRating: 'high',
        evidence: [
          'Inventory of approved privileged utilities',
          'Application allow-listing policy and coverage report',
          'Execution logs for privileged utilities'
        ],
        refs: { 'ISO-27001': ['A.8.18'], 'NCA-ECC': ['2-3-3'], 'NIST-800-53': ['AC-6'], 'CIS-V8': ['4'] }
      }
    ],
    procedure: {
      purpose: 'To define how privileged access is requested, approved, elevated, monitored, revoked and reviewed at {{orgName}}.',
      preconditions: [
        'The requester holds a dedicated privileged account distinct from their standard account.',
        'The target system is onboarded to the privileged access management solution.',
        'The privileged account inventory records a named human owner for the account.'
      ],
      inputs: [
        'Privileged access or elevation request with task description and duration',
        'Change record or incident ticket justifying the administrative activity',
        'Privileged account inventory and current entitlement position'
      ],
      steps: [
        { name: 'Request elevation', actor: 'Administrator', detail: 'Submit an elevation request recording the task, the target system, the change or incident reference and the required duration, which shall not exceed {{jitMaxDuration}}.' },
        { name: 'Validate justification', actor: 'IAM Specialist', detail: 'Confirm the referenced change or incident is valid and in an approved state, and that the requested privilege level is the minimum sufficient for the task.', decision: { question: 'Is a valid change or incident reference present?', yes: 'Continue to Approval', no: 'Reject and return to the requester for a change record' } },
        { name: 'Approve', actor: 'CISO / Cybersecurity GRC Manager', detail: 'Approve or reject the elevation. Elevation on critical systems and any request exceeding {{jitMaxDuration}} requires CISO approval.', decision: { question: 'Is the elevation approved?', yes: 'Continue to Elevation', no: 'Close with recorded rejection reason' } },
        { name: 'Elevate', actor: 'Privileged Access Management platform', detail: 'Activate the privileged role for the approved duration and check out the vaulted credential. Establish the session through the session broker with recording enabled.' },
        { name: 'Perform and record', actor: 'Administrator', detail: 'Perform the administrative task within the approved scope. All activity is recorded and retained for {{sessionRecordingRetention}}.' },
        { name: 'Expire and rotate', actor: 'Privileged Access Management platform', detail: 'Withdraw the privilege automatically at the end of the approved duration and rotate the credential {{vaultRotationFrequency}}.' },
        { name: 'Monitor', actor: 'SOC Analyst', detail: 'Review privileged activity alerts against the defined detection use cases.', decision: { question: 'Is the activity consistent with the approved task?', yes: 'Close the alert with rationale', no: 'Raise a cybersecurity incident and escalate' } },
        { name: 'Review', actor: 'CISO / System Owner', detail: 'Recertify privileged entitlements {{privAccessReviewFrequency}}, using activation history to identify entitlements that should be removed.' }
      ],
      outputs: [
        'Time-bounded privileged access granted and automatically withdrawn',
        'Recorded privileged session retained for {{sessionRecordingRetention}}',
        'Rotated privileged credential',
        'Updated privileged entitlement position'
      ],
      escalation: [
        'Privileged activity outside the approved task scope escalates immediately to the CISO as a suspected incident.',
        'Break-glass account use triggers an immediate alert and review within {{emergencyAccessReviewSla}}.',
        'Failure to rotate a privileged credential after use escalates to the IT Manager within 1 business day.',
        'Discovery of an unmanaged privileged account escalates to the Cybersecurity GRC Manager for onboarding within 10 business days.'
      ],
      records: [
        'Elevation request, approval and expiry records (retained 3 years)',
        'Privileged session recordings (retained {{sessionRecordingRetention}})',
        'Credential rotation logs (retained 12 months)',
        'Privileged access review results and sign-off (retained 3 years)'
      ],
      kpis: [
        { name: 'Just-in-time activation rate', target: '90% of privileged activations are time-bounded' },
        { name: 'Vault coverage', target: '100% of privileged credentials vaulted' },
        { name: 'Session recording coverage', target: '100% of critical-system privileged sessions recorded' },
        { name: 'Break-glass review timeliness', target: '100% reviewed within {{emergencyAccessReviewSla}}' }
      ]
    },
    roles: ['ciso', 'grc_manager', 'iam_specialist', 'it_manager', 'soc_analyst', 'system_owner', 'internal_auditor'],
    raciActivities: [
      { activity: 'Define and approve the Privileged Access Management Policy', phase: 'Govern', assign: { ciso: 'A', grc_manager: 'R', iam_specialist: 'C', it_manager: 'C', soc_analyst: 'I', system_owner: 'I', internal_auditor: 'I' } },
      { activity: 'Maintain the privileged account inventory', phase: 'Govern', assign: { ciso: 'I', grc_manager: 'A', iam_specialist: 'R', it_manager: 'C', soc_analyst: 'I', system_owner: 'C', internal_auditor: 'I' } },
      { activity: 'Onboard privileged accounts to the vault', phase: 'Protect', assign: { ciso: 'I', grc_manager: 'C', iam_specialist: 'R', it_manager: 'A', soc_analyst: 'I', system_owner: 'C', internal_auditor: 'I' } },
      { activity: 'Approve privilege elevation requests', phase: 'Operate', assign: { ciso: 'A', grc_manager: 'R', iam_specialist: 'C', it_manager: 'C', soc_analyst: 'I', system_owner: 'C', internal_auditor: 'I' } },
      { activity: 'Perform administrative activity under elevation', phase: 'Operate', assign: { ciso: 'I', grc_manager: 'I', iam_specialist: 'C', it_manager: 'A', soc_analyst: 'I', system_owner: 'R', internal_auditor: 'I' } },
      { activity: 'Rotate privileged credentials', phase: 'Protect', assign: { ciso: 'I', grc_manager: 'I', iam_specialist: 'R', it_manager: 'A', soc_analyst: 'I', system_owner: 'I', internal_auditor: 'I' } },
      { activity: 'Monitor privileged activity alerts', phase: 'Detect', assign: { ciso: 'A', grc_manager: 'I', iam_specialist: 'C', it_manager: 'I', soc_analyst: 'R', system_owner: 'I', internal_auditor: 'I' } },
      { activity: 'Authorise and review break-glass access', phase: 'Operate', assign: { ciso: 'A', grc_manager: 'R', iam_specialist: 'R', it_manager: 'C', soc_analyst: 'C', system_owner: 'I', internal_auditor: 'C' } },
      { activity: 'Conduct privileged access review', phase: 'Assure', assign: { ciso: 'A', grc_manager: 'R', iam_specialist: 'R', it_manager: 'C', soc_analyst: 'I', system_owner: 'R', internal_auditor: 'C' } },
      { activity: 'Audit privileged access controls', phase: 'Assure', assign: { ciso: 'I', grc_manager: 'A', iam_specialist: 'C', it_manager: 'I', soc_analyst: 'I', system_owner: 'I', internal_auditor: 'R' } }
    ]
  }
};
