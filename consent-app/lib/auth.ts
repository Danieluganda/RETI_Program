export type AuthUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "partner";
  partner?: "richblack" | "busala" | "uncdf";
  homePath: string;
};

export const authUsers: AuthUser[] = [
  {
    id: "usr-demo",
    name: "Demo Collector",
    email: process.env.DEMO_USER_EMAIL || "collector@10x.local",
    password: process.env.DEMO_USER_PASSWORD || "password123",
    role: "admin",
    homePath: "/dashboard",
  },
  {
    id: "partner-richblack",
    name: "Richblack",
    email: process.env.RICHBLACK_USER_EMAIL || "richblack@10x.local",
    password: process.env.RICHBLACK_USER_PASSWORD || "richblack-local-password",
    role: "partner",
    partner: "richblack",
    homePath: "/richblack",
  },
  {
    id: "partner-busala",
    name: "Busala",
    email: process.env.BUSALA_USER_EMAIL || "busala@10x.local",
    password: process.env.BUSALA_USER_PASSWORD || "busala-local-password",
    role: "partner",
    partner: "busala",
    homePath: "/busala",
  },
  {
    id: "partner-uncdf",
    name: "UNCDF",
    email: process.env.UNCDF_USER_EMAIL || "uncdf@10x.local",
    password: process.env.UNCDF_USER_PASSWORD || "uncdf-local-password",
    role: "partner",
    partner: "uncdf",
    homePath: "/uncdf",
  },
];

export function userToken(userId: string) {
  return `consent-token-${userId}`;
}

export function userByToken(token?: string) {
  if (!token) return null;
  const userId = token.replace(/^consent-token-/, "").replace(/^demo-token-/, "");
  const user = authUsers.find((candidate) => candidate.id === userId);
  if (!user) return null;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function validateLogin(email?: string, password?: string) {
  const matchingUser = authUsers.find((user) => email === user.email && password === user.password);

  if (matchingUser) {
    const { password: _password, ...user } = matchingUser;
    return user;
  }

  return null;
}
