import pandas as pd
import numpy as np

class DataValidator:
    """Classe pour valider et nettoyer les données géologiques"""
    
    def __init__(self):
        self.required_columns = [
            'N° Anomalie', 'Début_EUTM', 'Début_NUTM', 'Fin_EUTM', 'Fin_NUTM',
            'Longueur (m)', 'de (m)', 'à (m)', 'Épaisseur (m)', 
            'Moyenne U (ppm)', 'Max U (ppm)', 'Lithologie'
        ]
        
        self.numeric_columns = [
            'Début_EUTM', 'Début_NUTM', 'Fin_EUTM', 'Fin_NUTM', 
            'Direction', 'Longueur (m)', 'de (m)', 'à (m)', 
            'Épaisseur (m)', 'Moyenne U (ppm)', 'Max U (ppm)'
        ]
    
    def validate_file_structure(self, df):
        """Valide la structure du fichier CSV"""
        errors = []
        warnings = []
        
        # Vérifier les colonnes requises
        missing_cols = [col for col in self.required_columns if col not in df.columns]
        if missing_cols:
            errors.append(f"Colonnes manquantes: {', '.join(missing_cols)}")
        
        # Vérifier si le DataFrame est vide
        if len(df) == 0:
            errors.append("Le fichier ne contient aucune donnée")
        
        # Vérifier les types de données
        for col in self.numeric_columns:
            if col in df.columns:
                non_numeric = df[col].apply(lambda x: not self._is_numeric(x)).sum()
                if non_numeric > 0:
                    warnings.append(f"Colonne '{col}': {non_numeric} valeurs non numériques détectées")
        
        return errors, warnings
    
    def _is_numeric(self, value):
        """Vérifie si une valeur peut être convertie en nombre"""
        if pd.isna(value):
            return True  # NaN est acceptable
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False
    
    def clean_data(self, df):
        """Nettoie et prépare les données"""
        df_clean = df.copy()
        
        # Conversion des colonnes numériques
        for col in self.numeric_columns:
            if col in df_clean.columns:
                df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')
        
        # Nettoyage des coordonnées
        coord_cols = ['Début_EUTM', 'Début_NUTM', 'Fin_EUTM', 'Fin_NUTM']
        for col in coord_cols:
            if col in df_clean.columns:
                # Supprimer les valeurs aberrantes (coordonnées trop petites ou trop grandes)
                df_clean = df_clean[
                    (df_clean[col] > 100000) & (df_clean[col] < 10000000)
                ]
        
        # Nettoyage des profondeurs
        depth_cols = ['de (m)', 'à (m)']
        for col in depth_cols:
            if col in df_clean.columns:
                # Les profondeurs doivent être positives
                df_clean = df_clean[df_clean[col] >= 0]
        
        # Vérifier la cohérence des profondeurs
        if all(col in df_clean.columns for col in depth_cols):
            df_clean = df_clean[df_clean['à (m)'] > df_clean['de (m)']]
        
        # Nettoyage des teneurs
        grade_cols = ['Moyenne U (ppm)', 'Max U (ppm)']
        for col in grade_cols:
            if col in df_clean.columns:
                # Les teneurs doivent être positives
                df_clean = df_clean[df_clean[col] >= 0]
        
        # Vérifier la cohérence des teneurs
        if all(col in df_clean.columns for col in grade_cols):
            df_clean = df_clean[df_clean['Max U (ppm)'] >= df_clean['Moyenne U (ppm)']]
        
        # Nettoyage de la lithologie
        if 'Lithologie' in df_clean.columns:
            df_clean['Lithologie'] = df_clean['Lithologie'].fillna('Inconnu')
            df_clean['Lithologie'] = df_clean['Lithologie'].astype(str).str.strip()
        
        return df_clean
    
    def get_data_summary(self, df):
        """Génère un résumé des données"""
        summary = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'missing_values': df.isnull().sum().sum(),
            'numeric_columns': len([col for col in df.columns if df[col].dtype in ['int64', 'float64']]),
            'coordinate_range': {},
            'grade_range': {},
            'lithology_types': []
        }
        
        # Plage des coordonnées
        coord_cols = ['Début_EUTM', 'Début_NUTM', 'Fin_EUTM', 'Fin_NUTM']
        for col in coord_cols:
            if col in df.columns and df[col].dtype in ['int64', 'float64']:
                summary['coordinate_range'][col] = {
                    'min': df[col].min(),
                    'max': df[col].max()
                }
        
        # Plage des teneurs
        grade_cols = ['Moyenne U (ppm)', 'Max U (ppm)']
        for col in grade_cols:
            if col in df.columns and df[col].dtype in ['int64', 'float64']:
                summary['grade_range'][col] = {
                    'min': df[col].min(),
                    'max': df[col].max(),
                    'mean': df[col].mean()
                }
        
        # Types de lithologie
        if 'Lithologie' in df.columns:
            summary['lithology_types'] = df['Lithologie'].value_counts().to_dict()
        
        return summary

# Test du validateur
if __name__ == "__main__":
    validator = DataValidator()
    
    # Test avec des données d'exemple
    test_data = {
        'N° Anomalie': [1, 2, 3],
        'Début_EUTM': ['500000', '500100', '500200'],
        'Début_NUTM': [4500000, 4500100, 4500200],
        'Fin_EUTM': [500050, 500150, 500250],
        'Fin_NUTM': [4500050, 4500150, 4500250],
        'Longueur (m)': [100, 150, 120],
        'de (m)': [0, 10, 5],
        'à (m)': [50, 60, 55],
        'Épaisseur (m)': [2.5, 3.0, 2.8],
        'Moyenne U (ppm)': [45, 67, 52],
        'Max U (ppm)': [78, 89, 71],
        'Lithologie': ['Granite', 'Schiste', 'Quartzite']
    }
    
    df_test = pd.DataFrame(test_data)
    
    errors, warnings = validator.validate_file_structure(df_test)
    print("Erreurs:", errors)
    print("Avertissements:", warnings)
    
    df_clean = validator.clean_data(df_test)
    print("Données nettoyées:", df_clean.shape)
    
    summary = validator.get_data_summary(df_clean)
    print("Résumé:", summary)
