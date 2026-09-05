import WarRoom from './App';
import SpacetimeRoomProvider from './SpacetimeRoomProvider';

export default function WarRoomRoute() {
  return (
    <SpacetimeRoomProvider>
      <WarRoom />
    </SpacetimeRoomProvider>
  );
}
