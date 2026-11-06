import { useState } from "react";
import { Link } from "react-router";
import { signIn, signInWithGoogle } from "../lib/auth";
import Header from '../components/Sheared/Header';

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
    <>
    <Header />
    <div
      className="flex flex-col gap-4 items-center justify-center p-4 
    absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black md:w-80 md:h-auto h-full w-full rounded-2xl border-2 border-white/20"
    >
      
      <h1 className="text-3xl font-bold">Log in</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <input
          className="p-2 rounded-full px-4"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={true}
        />

        <input
          className="p-2 rounded-full px-4"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={true}
        />

        <button type="submit" className="text-white py-1 bg-ruby w-full">Log in</button>
      </form>

      <button
        className="text-black py-1 bg-cream w-full"
        onClick={() => signInWithGoogle()}
      >
        Continue with Google
      </button>

      <p>
        Don't have an account? <Link to="/signup" className="text-cream hover:text-white hover:underline bg-ruby py-1 px-2 rounded-lg ml-2">Sign up</Link>
      </p>
    </div></>
    
  );
};

export default Login;
