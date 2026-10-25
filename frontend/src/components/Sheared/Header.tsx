import { useIsAuthenticated } from "../../lib/authorization";

type HeaderProps = {
  onSettingsClick?: () => void;
};

const Header = ({ onSettingsClick }: HeaderProps) => {
  const isAuthenticated = useIsAuthenticated();

  return (
    <header className="absolute flex justify-around top-0 left-0 w-full bg-gray-800 text-white p-4">
      <h1><a href="/" className="hover:underline">Chess Pet project</a></h1>
      <nav>
        <ul className="flex space-x-4">
          <li><a href="/game" className="hover:underline">Game</a></li>
          {isAuthenticated === false ? (
            <>
              <li><a href="/signup" className="hover:underline">Sign up</a></li>
              <li><a href="/login" className="hover:underline">Log in</a></li>
            </>
          ) : onSettingsClick ? (
            <li><button className="hover:underline" onClick={onSettingsClick}>Settings</button></li>
          ) : null}
        </ul>
      </nav>
    </header>
  );
};

export default Header;