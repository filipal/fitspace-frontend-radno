import { useSearchParams } from 'react-router-dom'

export const useDebug = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  
  const isDebug = searchParams.get('debug') === 'true'
  
  const toggleDebug = () => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      if (newParams.get('debug') === 'true') {
        newParams.delete('debug')
      } else {
        newParams.set('debug', 'true')
      }
      return newParams
    })
  }
  
  const enableDebug = () => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.set('debug', 'true')
      return newParams
    })
  }
  
  const disableDebug = () => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.delete('debug')
      return newParams
    })
  }
  
  return { 
    isDebug, 
    toggleDebug, 
    enableDebug, 
    disableDebug 
  }
}
