import { type ReactNode } from 'react'
import styles from './DataPanel.module.scss'

interface DataPanelProps {
  title: string
  children?: ReactNode
  measurements?: Array<{ name: string; value: number; icon: string }>
}

export default function DataPanel({ title, children, measurements }: DataPanelProps) {
  return (
    <div className={styles.dataPanel}>
      <div className={styles.dataPanelHeader}>
        <p>{title}</p>
      </div>
      <div className={styles.dataPanelContent}>
        {measurements ? (
          <div className={styles.measurementsList}>
            {measurements.map((m, idx) => (
              <div key={idx} className={styles.measurementItem}>
                <span className={styles.measurementIcon}>
                  <img src={m.icon} alt="" />
                </span>
                <span className={styles.measurementName}>{m.name}</span>
                <span className={styles.measurementValue}>{m.value}</span>
              </div>
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}