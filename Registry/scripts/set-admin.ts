// Bootstraps (or promotes) an admin:
//   npm run set-admin:prod -- you@example.com --name "Adeepa" --scripts si [--password]
// --password asks for a password at a hidden prompt (so it never lands in shell history).
import { createInterface } from "node:readline";
import { arg, auth, db, target } from "./admin-app";

/** Asks each question with the typed answer hidden. Piped (non-TTY) input is read line by line instead. */
async function askHidden(questions: string[]): Promise<string[]> {
  if (!process.stdin.isTTY) {
    let input = "";
    for await (const chunk of process.stdin) input += chunk;
    return input.split(/\r?\n/).slice(0, questions.length);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  out._writeToOutput = (s: string) => {
    if (!muted) out.output.write(s);
  };
  const answers: string[] = [];
  for (const q of questions) {
    answers.push(
      await new Promise<string>((resolve) => {
        muted = false;
        rl.question(q, (a) => {
          process.stdout.write("\n");
          resolve(a);
        });
        muted = true;
      }),
    );
  }
  rl.close();
  return answers;
}

async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email || !email.includes("@")) {
    console.error('Usage: npm run set-admin -- <email> [--name "Name"] [--scripts si,ta] [--password]');
    process.exit(1);
  }
  const scripts = (arg("scripts", "") ?? "").split(",").filter((s) => s === "si" || s === "ta");
  let password: string | undefined;
  if (arg("password") !== undefined) {
    const [first = "", again = ""] = await askHidden(["Password (min 6 characters): ", "Repeat password: "]);
    if (first.length < 6) throw new Error("Password must be at least 6 characters");
    if (first !== again) throw new Error("Passwords don't match");
    password = first;
  }
  const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email }));
  if (password) await auth.updateUser(user.uid, { password });
  const ref = db.collection("users").doc(user.uid);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      tx.update(ref, { role: "admin", active: true, ...(scripts.length ? { scripts } : {}) });
      return;
    }
    const counter = db.collection("counters").doc("raters");
    const n = ((await tx.get(counter)).data()?.nextNumber as number | undefined) ?? 1;
    tx.set(ref, {
      email,
      displayName: arg("name") ?? email.split("@")[0],
      role: "admin",
      scripts,
      active: true,
      alias: `R${String(n).padStart(2, "0")}`,
      createdAt: Date.now(),
    });
    tx.set(counter, { nextNumber: n + 1 }, { merge: true });
  });
  console.log(`✓ ${email} is an admin on ${target()}${password ? " (password set)" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
