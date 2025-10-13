export interface NetworkInformationLike {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

export const getNetworkInformation = (nav: Navigator): NetworkInformationLike | undefined => {
  const connection = (nav as Navigator & { connection?: NetworkInformationLike }).connection
  if (!connection) {
    return undefined
  }

  const info: NetworkInformationLike = {}

  if (typeof connection.effectiveType === 'string') {
    info.effectiveType = connection.effectiveType
  }
  if (typeof connection.downlink === 'number' && Number.isFinite(connection.downlink)) {
    info.downlink = connection.downlink
  }
  if (typeof connection.rtt === 'number' && Number.isFinite(connection.rtt)) {
    info.rtt = connection.rtt
  }
  if (typeof connection.saveData === 'boolean') {
    info.saveData = connection.saveData
  }

  return Object.keys(info).length ? info : undefined
}