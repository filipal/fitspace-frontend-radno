import { useAvatarConfiguration } from "../context/AvatarConfigurationContext";

export function AvatarSummary() {
  const { backendAvatar, morphValues } = useAvatarConfiguration();

  if (!backendAvatar) {
    return <p>No avatars loaded.</p>;
  }

  const { name, userId, createdAt, updatedAt } = backendAvatar;

  return (
    <section>
      <h2>{name}</h2>
      <dl>
        <div>
          <dt>User ID</dt>
          <dd>{userId ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{createdAt ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Last Updated</dt>
          <dd>{updatedAt ?? "Unknown"}</dd>
        </div>
      </dl>
      <h3>Morph values</h3>
      <ul>
        {Object.entries(morphValues).map(([key, value]) => (
          <li key={key}>
            <strong>{key}:</strong> {value.toFixed(3)}
          </li>
        ))}
      </ul>
    </section>
  );
}