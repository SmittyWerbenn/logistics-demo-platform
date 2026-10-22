import UserManagementView from "./UserManagementView";

/** Management User: every account except Drivers (those have their own menu). */
export default function UserManagement() {
  return <UserManagementView group="staff" />;
}
