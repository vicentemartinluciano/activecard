const KEY = "activecard.cloud.refresh.v1";
function store() {
  try { return require("expo-secure-store"); }
  catch { throw new Error("Para conectar la cuenta, instalá la APK 1.6.0 con almacenamiento seguro."); }
}
export const readRefreshToken = () => store().getItemAsync(KEY);
export const readRememberSession = async () => true;
export async function saveRefreshToken(token) {
  if (token) await store().setItemAsync(KEY, token);
  else await store().deleteItemAsync(KEY);
}
