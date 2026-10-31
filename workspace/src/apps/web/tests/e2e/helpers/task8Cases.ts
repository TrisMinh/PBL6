export interface Task8Case {
  nodeId: string;
  slug: string;
  url: string;
}

export const TASK8_CASES: readonly Task8Case[] = [
  {
    nodeId: "1185:61",
    slug: "organizations-list",
    url: "/admin/organizations",
  },
  {
    nodeId: "1185:760",
    slug: "organization-detail-blue-line",
    url: "/admin/organizations/ORG-001",
  },
  {
    nodeId: "1185:834",
    slug: "organization-create",
    url: "/admin/organizations?dialog=create",
  },
  { nodeId: "1186:764", slug: "staff-list", url: "/admin/staff" },
  {
    nodeId: "1186:778",
    slug: "staff-detail-nguyen-hoang-long",
    url: "/admin/staff/USR-0018",
  },
  {
    nodeId: "1215:162",
    slug: "staff-detail-tran-thu-ha",
    url: "/admin/staff/USR-0019",
  },
  {
    nodeId: "1215:241",
    slug: "staff-detail-hoang-nam",
    url: "/admin/staff/USR-0021",
  },
  {
    nodeId: "1215:320",
    slug: "staff-detail-le-minh-anh",
    url: "/admin/staff/USR-0024",
  },
  {
    nodeId: "1230:847",
    slug: "staff-detail-pham-ngoc-mai",
    url: "/admin/staff/USR-0031",
  },
  {
    nodeId: "1230:926",
    slug: "staff-detail-le-minh-khang",
    url: "/admin/staff/USR-0032",
  },
  {
    nodeId: "1230:1005",
    slug: "staff-detail-vo-thanh-dat",
    url: "/admin/staff/USR-0033",
  },
  {
    nodeId: "1230:1084",
    slug: "staff-detail-bui-khanh-linh",
    url: "/admin/staff/USR-0034",
  },
  {
    nodeId: "1230:1163",
    slug: "staff-detail-do-minh-anh",
    url: "/admin/staff/USR-0035",
  },
  {
    nodeId: "1230:1242",
    slug: "staff-detail-hoang-quoc-bao",
    url: "/admin/staff/USR-0036",
  },
  {
    nodeId: "1230:1321",
    slug: "staff-detail-ngo-lan-chi",
    url: "/admin/staff/USR-0037",
  },
  {
    nodeId: "1234:272",
    slug: "organization-member-create-fixed",
    url: "/admin/organizations/ORG-001?dialog=create-member",
  },
  {
    nodeId: "1236:312",
    slug: "staff-member-create",
    url: "/admin/staff?dialog=create",
  },
  {
    nodeId: "1237:340",
    slug: "organization-members-create",
    url: "/admin/organizations/ORG-001?view=members&dialog=create-member",
  },
  {
    nodeId: "1237:1218",
    slug: "organization-member-edit-nguyen-hoang-long",
    url: "/admin/organizations/ORG-001?view=members&dialog=edit-member&staffId=USR-0018",
  },
  {
    nodeId: "1238:414",
    slug: "organization-member-edit-tran-thu-ha",
    url: "/admin/organizations/ORG-001?view=members&dialog=edit-member&staffId=USR-0019",
  },
  {
    nodeId: "1238:545",
    slug: "organization-member-edit-hoang-nam",
    url: "/admin/organizations/ORG-001?view=members&dialog=edit-member&staffId=USR-0021",
  },
  {
    nodeId: "1238:676",
    slug: "staff-edit-nguyen-hoang-long",
    url: "/admin/staff/USR-0018?dialog=edit",
  },
  {
    nodeId: "1239:520",
    slug: "staff-edit-tran-thu-ha",
    url: "/admin/staff/USR-0019?dialog=edit",
  },
  {
    nodeId: "1239:735",
    slug: "staff-edit-hoang-nam",
    url: "/admin/staff/USR-0021?dialog=edit",
  },
  {
    nodeId: "1239:950",
    slug: "staff-edit-pham-ngoc-mai",
    url: "/admin/staff/USR-0031?dialog=edit",
  },
  {
    nodeId: "1239:1762",
    slug: "staff-edit-le-minh-khang",
    url: "/admin/staff/USR-0032?dialog=edit",
  },
  {
    nodeId: "1239:1977",
    slug: "staff-edit-vo-thanh-dat",
    url: "/admin/staff/USR-0033?dialog=edit",
  },
  {
    nodeId: "1239:2192",
    slug: "staff-edit-bui-khanh-linh",
    url: "/admin/staff/USR-0034?dialog=edit",
  },
  {
    nodeId: "1239:2407",
    slug: "staff-edit-do-minh-anh",
    url: "/admin/staff/USR-0035?dialog=edit",
  },
  {
    nodeId: "1239:2622",
    slug: "staff-edit-hoang-quoc-bao",
    url: "/admin/staff/USR-0036?dialog=edit",
  },
  {
    nodeId: "1239:2837",
    slug: "staff-edit-ngo-lan-chi",
    url: "/admin/staff/USR-0037?dialog=edit",
  },
];
