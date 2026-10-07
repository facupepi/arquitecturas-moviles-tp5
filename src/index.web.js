// Entrada de la app en la web (WP5, 7.4). index.html la carga con <script type="module">.
import './reset.css';
import './firebase/appCheck'; // antes que cualquier uso de Firestore
import { registrarServiceWorker } from './plataforma/registroSW';
import { AppRegistry } from 'react-native';
import App from './App';

registrarServiceWorker(); // desde la primera visita, también en Ingreso (instalación y uso sin red)
AppRegistry.registerComponent('SanFranciscoConecta', () => App);
AppRegistry.runApplication('SanFranciscoConecta', { rootTag: document.getElementById('root') });
