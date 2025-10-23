import { Navigate } from 'react-router-dom'

export default function VirtualTryOnRedirect() {
  return <Navigate to="/unreal-measurements" replace state={{ initialView: 'virtualTryOn' }} />
}