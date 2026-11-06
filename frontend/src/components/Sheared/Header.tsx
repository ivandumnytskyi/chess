import { useIsAuthenticated } from "../../lib/authorization";

type HeaderProps = {
  onSettingsClick?: () => void;
};

const Header = ({ onSettingsClick }: HeaderProps) => {
  const isAuthenticated = useIsAuthenticated();
  return (
    <header className="absolute z-10 flex justify-around top-0 left-0 w-full bg-black text-white p-4">
      <h1>
        <a href="/" className="hover:underline">
          Chess Pet project
        </a>
      </h1>
      <nav>
        <ul className="flex space-x-4">
          {isAuthenticated === false ? (
            <>
              <li>
                <a href="/signup" className="text-cream hover:text-white hover:underline">
                  Sign up
                </a>
              </li>
              <li>
                <a href="/login" className="text-cream hover:text-white hover:underline">
                  Log in
                </a>
              </li>
            </>
          ) : onSettingsClick ? (
            <li>
              <button className="text-cream hover:text-white hover:underline" onClick={onSettingsClick}>
                Settings
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
