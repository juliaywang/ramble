import { MOBILE_APP_FILENAME, MOBILE_APP_URL } from "../lib/download";

export function DownloadAppLink({ block = false }: { block?: boolean }) {
  return (
    <a
      className={block ? "btn btn-ghost btn-block" : "btn btn-ghost"}
      href={MOBILE_APP_URL}
      download={MOBILE_APP_FILENAME}
    >
      Download the mobile app
    </a>
  );
}
