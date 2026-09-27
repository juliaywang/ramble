import { useEffect, useRef, useState } from "react";
import { firstName } from "../lib/format";
import { useFriends } from "../state/FriendsContext";
import { useRamble } from "../state/RambleContext";

export function AccountMenu() {
  const { user, go, logOut } = useRamble();
  const { incomingRequests } = useFriends();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const initial = firstName(user.name).slice(0, 1).toUpperCase();

  function choose(screen: "profile" | "friends" | "settings" | "info") {
    setOpen(false);
    go({ name: screen });
  }

  return (
    <div className="account-menu" ref={root}>
      <button
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((value) => !value)}
      >
        {user.photo ? <img src={user.photo} alt="" /> : <span>{initial}</span>}
        {incomingRequests.length > 0 ? <span className="account-badge-dot" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="account-dropdown" role="menu">
          <p className="account-dropdown-name">{user.name}</p>
          {user.username ? <p className="account-dropdown-handle">@{user.username}</p> : null}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); go({ name: "profile", mode: "view" }); }}>
            View profile
          </button>
          <button type="button" role="menuitem" onClick={() => choose("profile")}>
            Edit profile
          </button>
          <button type="button" role="menuitem" className="menu-item-friends" onClick={() => choose("friends")}>
            <span>Friends</span>
            {incomingRequests.length > 0 ? (
              <span className="badge-count badge-attention">{incomingRequests.length}</span>
            ) : null}
          </button>
          <button type="button" role="menuitem" onClick={() => choose("settings")}>
            Settings
          </button>
          <button type="button" role="menuitem" onClick={() => choose("info")}>
            Info
          </button>
          <button
            type="button"
            role="menuitem"
            className="account-logout"
            onClick={() => {
              setOpen(false);
              logOut();
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
