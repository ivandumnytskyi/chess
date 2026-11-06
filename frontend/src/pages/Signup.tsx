import { useState } from "react";
import { Link } from "react-router";
import { signUp, signInWithGoogle } from "../lib/auth";
import Header from '../components/Sheared/Header';

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

  try {
    const result = await signUp(email, password, username);
    if (result.confirmationRequired) {
      alert("Check your email to confirm your account.");
      return;
    }
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
    absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black md:w-80 md:h-auto h-full w-full rounded-2xl border-2 border-white/20"
    >
     
      <h1 className="text-3xl font-bold">Sign up</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <input
          className="p-2 rounded-full px-4"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          pattern="[A-Za-z0-9_]{3,20}"
          title="3-20 letters, numbers or underscores"
          required={true}
        />

        <input
          className="p-2 rounded-full px-4"
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

        <button type="submit" className="text-white py-1 bg-ruby w-full">Sign up</button>
      </form>

      <button
        className="text-black py-1 bg-cream w-full"
        onClick={() => signInWithGoogle()}
      >
        Continue with Google
      </button>

      <p>
        Have an account? <Link to="/login" className="text-cream hover:text-white hover:underline bg-ruby py-1 px-2 rounded-lg ml-2">Log in</Link>
      </p>
    </div>
  </>
  );
};

export default Signup;
