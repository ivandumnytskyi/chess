import { useState } from "react";
import { Link } from "react-router";
import { signIn, signInWithGoogle } from "../lib/auth";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

  try {
    await signIn(email, password);
    window.location.href = "/";
  } catch (error) {
    alert(error instanceof Error ? error.message : "Sign in failed");
  }
  }
  return (
    <div
      className="flex flex-col gap-4 items-center justify-center p-4 
    absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#000000]"
    >
      <h1>Log in</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <input
          className="p-2 border border-gray-300 rounded-full px-4"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={true}
        />

        <input
          className="p-2 border border-gray-300 rounded-full px-4"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={true}
        />

        <button type="submit">Log in</button>
      </form>

      <button
        className="text-black bg-amber-50 w-full"
        onClick={() => signInWithGoogle()}
      >
        Continue with Google
      </button>

      <p>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
};

export default Login;
