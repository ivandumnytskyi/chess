import { useState } from "react";
import { Link } from "react-router";
import { signUp, signInWithGoogle } from "../lib/auth";
import Header from '../components/Sheared/Header';

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

  try {
    await signUp(email, password);
    window.location.href = "/";
  } catch (error) {
    alert(error instanceof Error ? error.message : "Sign up failed");
  }
  }
  return (
    <>
    <Header />    
    <div
      className="flex flex-col gap-4 items-center justify-center p-4 
    absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#000000]"
    >
     
      <h1>Sign up</h1>

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

        <button type="submit">Sign up</button>
      </form>

      <button
        className="text-black bg-amber-50 w-full"
        onClick={() => signInWithGoogle()}
      >
        Continue with Google
      </button>

      <p>
        Have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  </>
  );
};

export default Signup;
