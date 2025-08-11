import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.cluster import DBSCAN
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import plotly.graph_objects as go
import plotly.express as px
from scipy.interpolate import griddata
from scipy.spatial.distance import cdist

class MiningDataProcessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.uranium_model = None
        self.thickness_model = None
        
    def load_and_preprocess_data(self, data_path=None, sample_data=None):
        """Charge et préprocesse les données géologiques"""
        if sample_data is not None:
            df = sample_data.copy()
        else:
            df = pd.read_csv(data_path)
        
        # Conversion des colonnes numériques avec gestion d'erreurs
        numeric_columns = [
            'Début_EUTM', 'Début_NUTM', 'Fin_EUTM', 'Fin_NUTM', 
            'Direction', 'Longueur (m)', 'de (m)', 'à (m)', 
            'Épaisseur (m)', 'Moyenne U (ppm)', 'Max U (ppm)'
        ]
        
        for col in numeric_columns:
            if col in df.columns:
                # Conversion en numérique avec gestion des erreurs
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Suppression des lignes avec des valeurs manquantes critiques
        critical_columns = ['Début_EUTM', 'Début_NUTM', 'Fin_EUTM', 'Fin_NUTM', 'Moyenne U (ppm)']
        df = df.dropna(subset=critical_columns)
        
        # Vérification qu'il reste des données
        if len(df) == 0:
            raise ValueError("Aucune donnée valide après nettoyage. Vérifiez le format de vos données.")
        
        # Calcul des coordonnées moyennes pour chaque segment
        df['X_mean'] = (df['Début_EUTM'] + df['Fin_EUTM']) / 2
        df['Y_mean'] = (df['Début_NUTM'] + df['Fin_NUTM']) / 2
        df['Z_mean'] = (df['de (m)'] + df['à (m)']) / 2
        
        # Gestion de la lithologie
        if 'Lithologie' in df.columns:
            # Remplacer les valeurs manquantes par 'Inconnu'
            df['Lithologie'] = df['Lithologie'].fillna('Inconnu')
            df['Lithologie_encoded'] = self.label_encoder.fit_transform(df['Lithologie'])
        else:
            df['Lithologie'] = 'Inconnu'
            df['Lithologie_encoded'] = 0
        
        # Calcul de features géométriques avec gestion des valeurs manquantes
        df['Longueur (m)'] = df['Longueur (m)'].fillna(df['Longueur (m)'].mean())
        df['Épaisseur (m)'] = df['Épaisseur (m)'].fillna(df['Épaisseur (m)'].mean())
        
        df['Volume_approx'] = df['Longueur (m)'] * df['Épaisseur (m)'] * 1  # Hauteur unitaire
        df['Gradient_U'] = df['Max U (ppm)'] - df['Moyenne U (ppm)']
        
        return df
    
    def create_sample_data(self, n_samples=200):
        """Crée des données d'exemple pour la démonstration"""
        np.random.seed(42)
        
        # Génération de coordonnées spatiales
        x_coords = np.random.uniform(500000, 502000, n_samples)
        y_coords = np.random.uniform(4500000, 4502000, n_samples)
        depths_start = np.random.uniform(0, 100, n_samples)
        depths_end = depths_start + np.random.uniform(5, 50, n_samples)
        
        # Génération de données géologiques
        lithologies = np.random.choice(['Granite', 'Schiste', 'Quartzite', 'Gneiss'], n_samples)
        directions = np.random.uniform(0, 360, n_samples)
        lengths = np.random.uniform(10, 200, n_samples)
        thicknesses = np.random.uniform(0.5, 15, n_samples)
        
        # Génération de teneurs en uranium avec corrélation spatiale
        uranium_base = 50 + 30 * np.sin(x_coords/1000) * np.cos(y_coords/1000)
        uranium_noise = np.random.normal(0, 10, n_samples)
        uranium_mean = np.maximum(0, uranium_base + uranium_noise)
        uranium_max = uranium_mean + np.random.uniform(0, 50, n_samples)
        
        data = {
            'N° Anomalie': range(1, n_samples + 1),
            'N° Tranche': np.random.randint(1, 20, n_samples),
            'Début_EUTM': x_coords,
            'Début_NUTM': y_coords,
            'Fin_EUTM': x_coords + np.random.uniform(-50, 50, n_samples),
            'Fin_NUTM': y_coords + np.random.uniform(-50, 50, n_samples),
            'Direction': directions,
            'Longueur (m)': lengths,
            'de (m)': depths_start,
            'à (m)': depths_end,
            'Épaisseur (m)': thicknesses,
            'Moyenne U (ppm)': uranium_mean,
            'Max U (ppm)': uranium_max,
            'Lithologie': lithologies
        }
        
        return pd.DataFrame(data)
    
    def spatial_clustering(self, df, eps=100, min_samples=3):
        """Effectue un clustering spatial des anomalies"""
        coords = df[['X_mean', 'Y_mean', 'Z_mean']].values
        coords_scaled = self.scaler.fit_transform(coords)
        
        clustering = DBSCAN(eps=eps/1000, min_samples=min_samples)
        df['Cluster'] = clustering.fit_predict(coords_scaled)
        
        return df
    
    def train_uranium_model(self, df):
        """Entraîne un modèle de prédiction des teneurs en uranium"""
        features = ['X_mean', 'Y_mean', 'Z_mean', 'Épaisseur (m)', 
                   'Longueur (m)', 'Lithologie_encoded', 'Direction']
        
        X = df[features]
        y = df['Moyenne U (ppm)']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        self.uranium_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.uranium_model.fit(X_train, y_train)
        
        # Évaluation
        y_pred = self.uranium_model.predict(X_test)
        mse = mean_squared_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        return {'mse': mse, 'r2': r2, 'feature_importance': 
                dict(zip(features, self.uranium_model.feature_importances_))}
    
    def interpolate_3d_grid(self, df, grid_resolution=50):
        """Crée une grille 3D interpolée des teneurs"""
        # Définition de la grille
        x_min, x_max = df['X_mean'].min(), df['X_mean'].max()
        y_min, y_max = df['Y_mean'].min(), df['Y_mean'].max()
        z_min, z_max = df['Z_mean'].min(), df['Z_mean'].max()
        
        x_grid = np.linspace(x_min, x_max, grid_resolution)
        y_grid = np.linspace(y_min, y_max, grid_resolution)
        z_grid = np.linspace(z_min, z_max, grid_resolution//2)
        
        # Points de données
        points = df[['X_mean', 'Y_mean', 'Z_mean']].values
        values = df['Moyenne U (ppm)'].values
        
        # Interpolation pour chaque niveau Z
        interpolated_grids = []
        for z in z_grid:
            xi, yi = np.meshgrid(x_grid, y_grid)
            zi = np.full_like(xi, z)
            
            # Interpolation
            grid_points = np.column_stack([xi.ravel(), yi.ravel(), zi.ravel()])
            interpolated = griddata(points, values, grid_points, method='linear', fill_value=0)
            interpolated = interpolated.reshape(xi.shape)
            
            interpolated_grids.append({
                'x': xi, 'y': yi, 'z': zi, 'values': interpolated, 'z_level': z
            })
        
        return interpolated_grids
    
    def calculate_ore_reserves(self, df, cutoff_grade=30):
        """Calcule les réserves minérales"""
        ore_data = df[df['Moyenne U (ppm)'] >= cutoff_grade].copy()
        
        # Calcul du tonnage (approximatif)
        ore_data['Tonnage'] = ore_data['Volume_approx'] * 2.7  # Densité moyenne 2.7 t/m³
        ore_data['Metal_content'] = ore_data['Tonnage'] * ore_data['Moyenne U (ppm)'] / 1e6
        
        reserves = {
            'total_tonnage': ore_data['Tonnage'].sum(),
            'average_grade': ore_data['Moyenne U (ppm)'].mean(),
            'metal_content': ore_data['Metal_content'].sum(),
            'ore_blocks': len(ore_data)
        }
        
        return reserves, ore_data

# Test du processeur
if __name__ == "__main__":
    processor = MiningDataProcessor()
    
    # Création de données d'exemple
    sample_df = processor.create_sample_data(200)
    print("Données d'exemple créées:")
    print(sample_df.head())
    
    # Préprocessing
    processed_df = processor.load_and_preprocess_data(sample_data=sample_df)
    print(f"\nDonnées préprocessées: {processed_df.shape}")
    
    # Clustering spatial
    clustered_df = processor.spatial_clustering(processed_df)
    print(f"Nombre de clusters identifiés: {clustered_df['Cluster'].nunique()}")
    
    # Entraînement du modèle
    model_results = processor.train_uranium_model(clustered_df)
    print(f"\nPerformance du modèle - R²: {model_results['r2']:.3f}")
    
    # Calcul des réserves
    reserves, ore_data = processor.calculate_ore_reserves(clustered_df)
    print(f"\nRéserves estimées:")
    print(f"Tonnage total: {reserves['total_tonnage']:.0f} tonnes")
    print(f"Teneur moyenne: {reserves['average_grade']:.1f} ppm U")
