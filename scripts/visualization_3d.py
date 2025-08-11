import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import numpy as np
import pandas as pd

class Mining3DVisualizer:
    def __init__(self):
        self.color_scales = {
            'uranium': 'Viridis',
            'depth': 'Blues',
            'thickness': 'Reds',
            'lithology': 'Set3'
        }
    
    def create_3d_scatter(self, df, color_by='Moyenne U (ppm)', size_by='Épaisseur (m)'):
        """Crée un graphique 3D scatter des données"""
        fig = go.Figure()
        
        # Points principaux
        fig.add_trace(go.Scatter3d(
            x=df['X_mean'],
            y=df['Y_mean'],
            z=df['Z_mean'],
            mode='markers',
            marker=dict(
                size=df[size_by] * 2,
                color=df[color_by],
                colorscale=self.color_scales['uranium'],
                colorbar=dict(title=color_by),
                opacity=0.8,
                line=dict(width=0.5, color='black')
            ),
            text=[f"Anomalie {row['N° Anomalie']}<br>"
                  f"Uranium: {row['Moyenne U (ppm)']:.1f} ppm<br>"
                  f"Épaisseur: {row['Épaisseur (m)']:.1f} m<br>"
                  f"Lithologie: {row['Lithologie']}"
                  for _, row in df.iterrows()],
            hovertemplate='%{text}<extra></extra>',
            name='Anomalies'
        ))
        
        fig.update_layout(
            title='Modèle 3D du Gisement Minier',
            scene=dict(
                xaxis_title='Est UTM (m)',
                yaxis_title='Nord UTM (m)',
                zaxis_title='Profondeur (m)',
                camera=dict(eye=dict(x=1.5, y=1.5, z=1.5))
            ),
            width=800,
            height=600
        )
        
        return fig
    
    def create_ore_body_visualization(self, df, cutoff_grade=30):
        """Visualise les corps minéralisés"""
        ore_data = df[df['Moyenne U (ppm)'] >= cutoff_grade]
        waste_data = df[df['Moyenne U (ppm)'] < cutoff_grade]
        
        fig = go.Figure()
        
        # Minerai
        if len(ore_data) > 0:
            fig.add_trace(go.Scatter3d(
                x=ore_data['X_mean'],
                y=ore_data['Y_mean'],
                z=ore_data['Z_mean'],
                mode='markers',
                marker=dict(
                    size=ore_data['Épaisseur (m)'] * 3,
                    color=ore_data['Moyenne U (ppm)'],
                    colorscale='Hot',
                    colorbar=dict(title='Teneur U (ppm)'),
                    opacity=0.9
                ),
                name=f'Minerai (≥{cutoff_grade} ppm)',
                text=[f"Teneur: {u:.1f} ppm" for u in ore_data['Moyenne U (ppm)']]
            ))
        
        # Stérile
        if len(waste_data) > 0:
            fig.add_trace(go.Scatter3d(
                x=waste_data['X_mean'],
                y=waste_data['Y_mean'],
                z=waste_data['Z_mean'],
                mode='markers',
                marker=dict(
                    size=3,
                    color='lightgray',
                    opacity=0.3
                ),
                name=f'Stérile (<{cutoff_grade} ppm)'
            ))
        
        fig.update_layout(
            title=f'Corps Minéralisés (Seuil: {cutoff_grade} ppm U)',
            scene=dict(
                xaxis_title='Est UTM (m)',
                yaxis_title='Nord UTM (m)',
                zaxis_title='Profondeur (m)'
            )
        )
        
        return fig
    
    def create_interpolated_surfaces(self, interpolated_grids, threshold=20):
        """Crée des surfaces interpolées 3D"""
        fig = go.Figure()
        
        for i, grid in enumerate(interpolated_grids[::2]):  # Prendre une grille sur deux
            # Masquer les valeurs faibles
            values = grid['values'].copy()
            values[values < threshold] = np.nan
            
            if not np.all(np.isnan(values)):
                fig.add_trace(go.Surface(
                    x=grid['x'],
                    y=grid['y'],
                    z=grid['z'],
                    surfacecolor=values,
                    colorscale='Viridis',
                    opacity=0.6,
                    name=f'Niveau {grid["z_level"]:.0f}m',
                    showscale=i==0
                ))
        
        fig.update_layout(
            title='Surfaces Interpolées des Teneurs',
            scene=dict(
                xaxis_title='Est UTM (m)',
                yaxis_title='Nord UTM (m)',
                zaxis_title='Profondeur (m)'
            )
        )
        
        return fig
    
    def create_lithology_distribution(self, df):
        """Visualise la distribution des lithologies"""
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=['Distribution 3D', 'Répartition par type', 
                           'Teneur par lithologie', 'Épaisseur par lithologie'],
            specs=[[{'type': 'scatter3d'}, {'type': 'pie'}],
                   [{'type': 'box'}, {'type': 'box'}]]
        )
        
        # 3D par lithologie
        lithologies = df['Lithologie'].unique()
        colors = px.colors.qualitative.Set3[:len(lithologies)]
        
        for i, litho in enumerate(lithologies):
            litho_data = df[df['Lithologie'] == litho]
            fig.add_trace(
                go.Scatter3d(
                    x=litho_data['X_mean'],
                    y=litho_data['Y_mean'],
                    z=litho_data['Z_mean'],
                    mode='markers',
                    marker=dict(color=colors[i], size=4),
                    name=litho
                ),
                row=1, col=1
            )
        
        # Diagramme en secteurs
        litho_counts = df['Lithologie'].value_counts()
        fig.add_trace(
            go.Pie(
                labels=litho_counts.index,
                values=litho_counts.values,
                name="Distribution"
            ),
            row=1, col=2
        )
        
        # Box plots
        for litho in lithologies:
            litho_data = df[df['Lithologie'] == litho]
            fig.add_trace(
                go.Box(y=litho_data['Moyenne U (ppm)'], name=litho, showlegend=False),
                row=2, col=1
            )
            fig.add_trace(
                go.Box(y=litho_data['Épaisseur (m)'], name=litho, showlegend=False),
                row=2, col=2
            )
        
        fig.update_layout(height=800, title_text="Analyse des Lithologies")
        return fig
    
    def create_grade_tonnage_curve(self, df):
        """Crée une courbe teneur-tonnage"""
        grades = np.linspace(df['Moyenne U (ppm)'].min(), 
                           df['Moyenne U (ppm)'].max(), 100)
        
        tonnages = []
        avg_grades = []
        
        for grade in grades:
            ore_data = df[df['Moyenne U (ppm)'] >= grade]
            if len(ore_data) > 0:
                tonnage = (ore_data['Volume_approx'] * 2.7).sum()  # Densité 2.7 t/m³
                avg_grade = ore_data['Moyenne U (ppm)'].mean()
            else:
                tonnage = 0
                avg_grade = 0
            
            tonnages.append(tonnage)
            avg_grades.append(avg_grade)
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        
        fig.add_trace(
            go.Scatter(x=grades, y=tonnages, name="Tonnage", line=dict(color='blue')),
            secondary_y=False
        )
        
        fig.add_trace(
            go.Scatter(x=grades, y=avg_grades, name="Teneur moyenne", line=dict(color='red')),
            secondary_y=True
        )
        
        fig.update_xaxes(title_text="Teneur de coupure (ppm U)")
        fig.update_yaxes(title_text="Tonnage (tonnes)", secondary_y=False)
        fig.update_yaxes(title_text="Teneur moyenne (ppm U)", secondary_y=True)
        
        fig.update_layout(title_text="Courbe Teneur-Tonnage")
        
        return fig

# Test du visualiseur
if __name__ == "__main__":
    from data_processor import MiningDataProcessor
    
    processor = MiningDataProcessor()
    sample_df = processor.create_sample_data(150)
    processed_df = processor.load_and_preprocess_data(sample_data=sample_df)
    
    visualizer = Mining3DVisualizer()
    
    # Test des visualisations
    fig_3d = visualizer.create_3d_scatter(processed_df)
    fig_ore = visualizer.create_ore_body_visualization(processed_df)
    fig_litho = visualizer.create_lithology_distribution(processed_df)
    fig_grade = visualizer.create_grade_tonnage_curve(processed_df)
    
    print("Visualisations créées avec succès!")
