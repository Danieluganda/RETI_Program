export const demoUser = {
  id: "usr-demo",
  name: "Demo Collector",
  email: process.env.DEMO_USER_EMAIL || "collector@10x.local",
  password: process.env.DEMO_USER_PASSWORD || "password123",
  role: "Data Collector",
};

export function validateLogin(email?: string, password?: string) {
  if (email === demoUser.email && password === demoUser.password) {
    const { password: _password, ...user } = demoUser;
    return user;
  }

  return null;
}
