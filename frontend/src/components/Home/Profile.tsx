type ProfileProps = {
  username: string | null;
  email: string | null;
};

const Profile = ({ username, email }: ProfileProps) => {
  const initial = (username ?? email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-gray-800 p-6 shadow-lg">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-2xl font-bold">
        {initial}
      </div>
      <div>
        <p className="text-2xl font-semibold">{username ?? "No username yet"}</p>
        {email && <p className="text-sm text-gray-400">{email}</p>}
      </div>
    </div>
  );
};

export default Profile;