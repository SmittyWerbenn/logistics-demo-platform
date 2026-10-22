import UserManagementView from "./UserManagementView";

/** Management User Driver: Driver accounts only, with their Nopol. */
export default function DriverUserManagement() {
  return <UserManagementView group="driver" />;
}
