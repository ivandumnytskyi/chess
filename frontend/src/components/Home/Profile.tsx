const Profile = ({ username }: { username: string }) => {
  return (
    <div className="flex items-center space-x-4">
      <p className="text-white text-lg">{username}</p>
    </div>
  );
};

export default Profile;