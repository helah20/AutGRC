/**
 * PCI DSS v4.0.1: the twelve principal requirements, as identifiers with the
 * standard's requirement titles.
 *
 * The PCI Security Standards Council releases the standard only after a
 * licence agreement is accepted in its document library, so the defined
 * approach requirements beneath each principal requirement are not held
 * here. Import the licensed text through the catalogue import to map at
 * requirement level.
 *
 * Row: [ref, title, domainKey, level, parentRef, statement]
 */

export const PCI_DSS_4 = [
  ["1","Install and Maintain Network Security Controls","network_security",1,null,"Install and Maintain Network Security Controls"],
  ["2","Apply Secure Configurations to All System Components","endpoint_security",1,null,"Apply Secure Configurations to All System Components"],
  ["3","Protect Stored Account Data","data_protection",1,null,"Protect Stored Account Data"],
  ["4","Protect Cardholder Data with Strong Cryptography During Transmission Over Open, Public Networks","cryptography",1,null,"Protect Cardholder Data with Strong Cryptography During Transmission Over Open, Public Networks"],
  ["5","Protect All Systems and Networks from Malicious Software","endpoint_security",1,null,"Protect All Systems and Networks from Malicious Software"],
  ["6","Develop and Maintain Secure Systems and Software","secure_sdlc",1,null,"Develop and Maintain Secure Systems and Software"],
  ["7","Restrict Access to System Components and Cardholder Data by Business Need to Know","iam",1,null,"Restrict Access to System Components and Cardholder Data by Business Need to Know"],
  ["8","Identify Users and Authenticate Access to System Components","iam",1,null,"Identify Users and Authenticate Access to System Components"],
  ["9","Restrict Physical Access to Cardholder Data","physical_security",1,null,"Restrict Physical Access to Cardholder Data"],
  ["10","Log and Monitor All Access to System Components and Cardholder Data","logging_monitoring",1,null,"Log and Monitor All Access to System Components and Cardholder Data"],
  ["11","Test Security of Systems and Networks Regularly","vulnerability_management",1,null,"Test Security of Systems and Networks Regularly"],
  ["12","Support Information Security with Organizational Policies and Programs","governance",1,null,"Support Information Security with Organizational Policies and Programs"]
];
