import { useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import styles from './UseOfData.module.scss'

export default function UseOfData() {
  const navigate = useNavigate()
  return (
    <div className={styles.useOfDataPage}>
      <Header title="Use of Personal Data" onExit={() => navigate('/')} />
      <div className={styles.content}>
        <span>
          To provide you with the most accurate and personalized virtual try-on experience, our solution creates a realistic 3D avatar based on your body profile. <br />This avatar helps simulate how clothing will look and fit on your unique physique.
        </span>
        <p>
          To achieve this, we use a combination of manual input and advanced machine learning techniques based on the following personal data:
        </p>
        <ol className={styles.dataList}>
          <li><b>1. Age Range</b>
          Your age range helps us estimate typical body composition associated with your life stage. This ensures your avatar reflects realistic proportions and characteristics.
          </li>
          <li><b>2. Height</b>
          Establishes the overall scale of your avatar and provides proportional accuracy across limbs and torso.
          </li>
          <li><b>3. Weight</b>
          Used alongside height to determine overall body mass and shape, which impacts clothing fit and avatar realism.</li>
          <li><b>4. Body Shape</b>
          Helps us model the overall silhouette and balance of your avatar’s torso, hips, and shoulders.</li>
          <li><b>5. Fitness Level</b>
          Provides insight into muscle tone, body composition, contributing to a more lifelike and personalized avatar.</li>
          <li><b>6. Main Measurements (Chest, Waist, Hips)</b>
          Key for defining torso proportions and ensuring a precise digital fit.</li>
          <li><b>7. Body Photos</b>
          Front and side photos of your body are used by our machine learning models to extract precise body measurements. This enables us to automatically and accurately replicate your real-world shape in 3D.</li>
          <li><b>8. Face Photos</b>
          Front and side photos of your face allows us to generate a realistic facial likeness for your avatar. This step is optional but enhances the personalization of your digital twin.</li>
        </ol>
        <div className={styles.sectionTitle}>Why We Collect This Information</div>
        <span>
          All of this data is used solely to create a more precise and realistic digital twin avatar. This allows the app to:
        </span>
        <ul className={styles.dotList}>
          <li>Create a highly accurate 3D avatar tailored to your actual body</li>
          <li>Simulate garment fit, size, and style with precision</li>
          <li>Improve clothing recommendations based on your true measurements</li>
          <li>Offer a realistic and confidence-boosting try-on experience</li>
        </ul>
        <div className={styles.privacyTitle}>Your Privacy Matters</div>
        <span>
          We take your privacy seriously.<br />
          All personal data is:
        </span>
        <ul className={styles.privacyList}>
          <li>Consent-based: All data is collected only with your clear permission.</li>
          <li>Secure storage:Photos and personal data are encrypted and stored securely, deleted right after creating your 3D model.</li>
          <li>Strict usage:Your data is used exclusively for avatar creation and virtual try-on.</li>
          <li>No sharing:We never share your data or images with third parties without your explicit consent.</li>
        </ul>
      </div>
      <button className={styles.backButtonUseofdata} onClick={() => navigate('/avatar-info')}>Back</button>
    </div>
  )
}
