// Filing numbers and contact details shown in the page footer once they exist. Empty strings render nothing,
// so this file is safe to ship before the filings are done. Fill in after the numbers are issued:
//   icp          e.g. "京ICP备12345678号-1"                       (links to beian.miit.gov.cn)
//   police       e.g. "京公网安备 11010502012345号"                (links to beian.mps.gov.cn)
//   policeCode   the digits of the police filing, used in that link
//   model        the filed model the AI runs on, shown with its filing number as the rules ask
export const SITE_RECORD = {
  icp: "",
  police: "",
  policeCode: "",
  model: "",
  modelFiling: "",
  contactEmail: "charlottehyuxuan@gmail.com",
};
