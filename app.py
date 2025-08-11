import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from scripts.data_processor import MiningDataProcessor
from scripts.visualization_3d import Mining3DVisualizer
import io
from scripts.data_validator import DataValidator

# Configuration de la page
st.set_page_config(
    page_title="Modélisation 3D de Gisement Minier",
    page_icon="⛏️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialisation des classes
@st.cache_resource
def init_processors():
    processor = MiningDataProcessor()
    visualizer = Mining3DVisualizer()
    return processor, visualizer

processor, visualizer = init_processors()

# Interface utilisateur
st.title("⛏️ Modélisation 3D de Gisement Minier")
st.markdown("---")

# Sidebar pour les paramètres
st.sidebar.header("Paramètres de Modélisation")

# Section de chargement des données
st.sidebar.subheader("📊 Données")
data_source = st.sidebar.radio(
    "Source des données:",
    ["Données d'exemple", "Charger un fichier CSV"]
)

# Chargement des données
@st.cache_data
def load_data(source_type, n_samples=200, uploaded_file=None):
    if source_type == "Données d'exemple":
        df = processor.create_sample_data(n_samples)
    else:
        if uploaded_file is not None:
            df = pd.read_csv(uploaded_file)
        else:
            return None
    
    return processor.load_and_preprocess_data(sample_data=df)

# Interface de chargement
if data_source == "Charger un fichier CSV":
    uploaded_file = st.sidebar.file_uploader(
        "Choisir un fichier CSV",
        type=['csv'],
        help="Le fichier doit contenir les colonnes: N° Anomalie, N° Tranche, Début_EUTM, Début_NUTM, Fin_EUTM, Fin_NUTM, Direction, Longueur (m), de (m), à (m), Épaisseur (m), Moyenne U (ppm), Max U (ppm), Lithologie"
    )
    
    if uploaded_file is not None:
        try:
            # Lecture initiale du fichier
            df_raw = pd.read_csv(uploaded_file)
            
            # Validation des données
            validator = DataValidator()
            errors, warnings = validator.validate_file_structure(df_raw)
            
            if errors:
                st.error("❌ Erreurs dans le fichier:")
                for error in errors:
                    st.error(f"• {error}")
                df = None
            else:
                if warnings:
                    st.warning("⚠️ Avertissements:")
                    for warning in warnings:
                        st.warning(f"• {warning}")
                
                # Nettoyage des données
                df_clean = validator.clean_data(df_raw)
                
                if len(df_clean) == 0:
                    st.error("❌ Aucune donnée valide après nettoyage.")
                    df = None
                else:
                    # Affichage du résumé
                    summary = validator.get_data_summary(df_clean)
                    st.success(f"✅ Fichier chargé: {summary['total_rows']} lignes, {len(df_clean)} lignes valides après nettoyage")
                    
                    df = load_data(data_source, uploaded_file=uploaded_file)
                    
        except Exception as e:
            st.error(f"❌ Erreur lors du chargement du fichier: {str(e)}")
            st.info("💡 Vérifiez que votre fichier CSV est correctement formaté.")
            df = None
    else:
        df = None
else:
    n_samples = st.sidebar.slider("Nombre d'échantillons", 50, 500, 200)
    try:
        df = load_data(data_source, n_samples=n_samples)
    except Exception as e:
        st.error(f"❌ Erreur lors de la génération des données: {str(e)}")
        df = None

if df is not None:
    # Paramètres de modélisation
    st.sidebar.subheader("🔧 Paramètres ML")
    cutoff_grade = st.sidebar.slider("Teneur de coupure (ppm U)", 0, 100, 30)
    clustering_eps = st.sidebar.slider("Distance clustering (m)", 50, 500, 100)
    grid_resolution = st.sidebar.slider("Résolution grille 3D", 20, 100, 50)
    
    # Traitement des données
    with st.spinner("Traitement des données en cours..."):
        # Clustering spatial
        df_clustered = processor.spatial_clustering(df, eps=clustering_eps)
        
        # Entraînement du modèle ML
        model_results = processor.train_uranium_model(df_clustered)
        
        # Calcul des réserves
        reserves, ore_data = processor.calculate_ore_reserves(df_clustered, cutoff_grade)
        
        # Interpolation 3D
        interpolated_grids = processor.interpolate_3d_grid(df_clustered, grid_resolution)
    
    # Interface principale
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📊 Données", "🎯 Modèle 3D", "💎 Corps Minéralisés", 
        "🧪 Analyse Géologique", "📈 Réserves"
    ])
    
    with tab1:
        st.header("Données Géologiques")
        
        col1, col2 = st.columns([2, 1])
        
        with col1:
            st.subheader("Aperçu des données")
            st.dataframe(df.head(20), use_container_width=True)
            
            # Statistiques descriptives
            st.subheader("Statistiques descriptives")
            numeric_cols = ['Moyenne U (ppm)', 'Max U (ppm)', 'Épaisseur (m)', 'Longueur (m)']
            st.dataframe(df[numeric_cols].describe(), use_container_width=True)
        
        with col2:
            st.subheader("Informations générales")
            st.metric("Nombre d'anomalies", len(df))
            st.metric("Nombre de clusters", df_clustered['Cluster'].nunique())
            st.metric("Lithologies", df['Lithologie'].nunique())
            
            st.subheader("Performance du modèle ML")
            st.metric("R² Score", f"{model_results['r2']:.3f}")
            st.metric("RMSE", f"{np.sqrt(model_results['mse']):.1f}")
            
            # Importance des features
            st.subheader("Importance des variables")
            importance_df = pd.DataFrame(
                list(model_results['feature_importance'].items()),
                columns=['Variable', 'Importance']
            ).sort_values('Importance', ascending=True)
            
            fig_importance = go.Figure(go.Bar(
                x=importance_df['Importance'],
                y=importance_df['Variable'],
                orientation='h'
            ))
            fig_importance.update_layout(
                title="Importance des Variables",
                height=300,
                margin=dict(l=0, r=0, t=30, b=0)
            )
            st.plotly_chart(fig_importance, use_container_width=True)
    
    with tab2:
        st.header("Modèle 3D du Gisement")
        
        col1, col2 = st.columns([3, 1])
        
        with col1:
            # Visualisation 3D principale
            color_option = st.selectbox(
                "Colorer par:",
                ['Moyenne U (ppm)', 'Max U (ppm)', 'Épaisseur (m)', 'Cluster']
            )
            
            size_option = st.selectbox(
                "Taille par:",
                ['Épaisseur (m)', 'Longueur (m)', 'Moyenne U (ppm)']
            )
            
            fig_3d = visualizer.create_3d_scatter(df_clustered, color_option, size_option)
            st.plotly_chart(fig_3d, use_container_width=True)
        
        with col2:
            st.subheader("Contrôles de vue")
            
            show_interpolation = st.checkbox("Afficher surfaces interpolées", False)
            
            if show_interpolation:
                threshold = st.slider("Seuil d'affichage (ppm)", 0, 50, 20)
                fig_surfaces = visualizer.create_interpolated_surfaces(
                    interpolated_grids, threshold
                )
                st.plotly_chart(fig_surfaces, use_container_width=True)
            
            # Filtres
            st.subheader("Filtres")
            selected_lithologies = st.multiselect(
                "Lithologies:",
                df['Lithologie'].unique(),
                default=df['Lithologie'].unique()
            )
            
            min_grade = st.slider(
                "Teneur min (ppm):",
                float(df['Moyenne U (ppm)'].min()),
                float(df['Moyenne U (ppm)'].max()),
                float(df['Moyenne U (ppm)'].min())
            )
    
    with tab3:
        st.header("Corps Minéralisés")
        
        col1, col2 = st.columns([2, 1])
        
        with col1:
            fig_ore = visualizer.create_ore_body_visualization(df_clustered, cutoff_grade)
            st.plotly_chart(fig_ore, use_container_width=True)
            
            # Courbe teneur-tonnage
            st.subheader("Courbe Teneur-Tonnage")
            fig_grade_tonnage = visualizer.create_grade_tonnage_curve(df_clustered)
            st.plotly_chart(fig_grade_tonnage, use_container_width=True)
        
        with col2:
            st.subheader("Réserves Minérales")
            st.metric("Tonnage total", f"{reserves['total_tonnage']:,.0f} t")
            st.metric("Teneur moyenne", f"{reserves['average_grade']:.1f} ppm U")
            st.metric("Contenu métal", f"{reserves['metal_content']:.2f} t U")
            st.metric("Blocs minéralisés", reserves['ore_blocks'])
            
            # Distribution des teneurs
            st.subheader("Distribution des teneurs")
            fig_hist = go.Figure(data=[
                go.Histogram(x=df_clustered['Moyenne U (ppm)'], nbinsx=30)
            ])
            fig_hist.add_vline(x=cutoff_grade, line_dash="dash", 
                              line_color="red", annotation_text="Seuil")
            fig_hist.update_layout(
                title="Distribution des teneurs",
                xaxis_title="Teneur U (ppm)",
                yaxis_title="Fréquence",
                height=300
            )
            st.plotly_chart(fig_hist, use_container_width=True)
    
    with tab4:
        st.header("Analyse Géologique")
        
        # Distribution des lithologies
        fig_litho = visualizer.create_lithology_distribution(df_clustered)
        st.plotly_chart(fig_litho, use_container_width=True)
        
        # Analyse par lithologie
        st.subheader("Statistiques par Lithologie")
        litho_stats = df_clustered.groupby('Lithologie').agg({
            'Moyenne U (ppm)': ['mean', 'std', 'count'],
            'Épaisseur (m)': ['mean', 'std'],
            'Longueur (m)': ['mean', 'std']
        }).round(2)
        
        st.dataframe(litho_stats, use_container_width=True)
    
    with tab5:
        st.header("Évaluation des Réserves")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("Réserves par Teneur de Coupure")
            
            # Calcul pour différentes teneurs
            cutoff_grades = np.arange(10, 101, 10)
            reserve_data = []
            
            for cutoff in cutoff_grades:
                res, _ = processor.calculate_ore_reserves(df_clustered, cutoff)
                reserve_data.append({
                    'Teneur de coupure': cutoff,
                    'Tonnage (t)': res['total_tonnage'],
                    'Teneur moyenne (ppm)': res['average_grade'],
                    'Contenu métal (t)': res['metal_content']
                })
            
            reserve_df = pd.DataFrame(reserve_data)
            st.dataframe(reserve_df, use_container_width=True)
        
        with col2:
            st.subheader("Optimisation Économique")
            
            # Paramètres économiques
            uranium_price = st.number_input("Prix uranium ($/kg)", value=130.0)
            mining_cost = st.number_input("Coût extraction ($/t)", value=50.0)
            processing_cost = st.number_input("Coût traitement ($/t)", value=30.0)
            recovery = st.slider("Récupération (%)", 0, 100, 85) / 100
            
            # Calcul de la valeur économique
            reserve_df['Valeur brute ($)'] = (
                reserve_df['Contenu métal (t)'] * 1000 * uranium_price * recovery
            )
            reserve_df['Coût total ($)'] = (
                reserve_df['Tonnage (t)'] * (mining_cost + processing_cost)
            )
            reserve_df['Profit ($)'] = (
                reserve_df['Valeur brute ($)'] - reserve_df['Coût total ($)']
            )
            
            # Teneur de coupure optimale
            optimal_cutoff = reserve_df.loc[reserve_df['Profit ($)'].idxmax(), 'Teneur de coupure']
            st.success(f"Teneur de coupure optimale: {optimal_cutoff} ppm U")
            
            # Graphique profit vs teneur
            fig_profit = go.Figure()
            fig_profit.add_trace(go.Scatter(
                x=reserve_df['Teneur de coupure'],
                y=reserve_df['Profit ($)'],
                mode='lines+markers',
                name='Profit'
            ))
            fig_profit.add_vline(x=optimal_cutoff, line_dash="dash", 
                                line_color="green", annotation_text="Optimal")
            fig_profit.update_layout(
                title="Profit vs Teneur de Coupure",
                xaxis_title="Teneur de coupure (ppm U)",
                yaxis_title="Profit ($)"
            )
            st.plotly_chart(fig_profit, use_container_width=True)
    
    # Export des résultats
    st.sidebar.subheader("💾 Export")
    if st.sidebar.button("Télécharger les résultats"):
        # Création d'un fichier Excel avec plusieurs onglets
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_clustered.to_excel(writer, sheet_name='Données', index=False)
            reserve_df.to_excel(writer, sheet_name='Réserves', index=False)
            ore_data.to_excel(writer, sheet_name='Minerai', index=False)
        
        st.sidebar.download_button(
            label="📥 Télécharger Excel",
            data=output.getvalue(),
            file_name="resultats_gisement.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

else:
    st.warning("Veuillez charger des données pour commencer l'analyse.")
    
    # Instructions d'utilisation
    st.markdown("""
    ## 📋 Instructions d'utilisation
    
    ### Format des données requis:
    Votre fichier CSV doit contenir les colonnes suivantes:
    - **N° Anomalie**: Identifiant unique de l'anomalie
    - **N° Tranche**: Numéro de la tranche
    - **Début_EUTM, Début_NUTM**: Coordonnées UTM de début
    - **Fin_EUTM, Fin_NUTM**: Coordonnées UTM de fin
    - **Direction**: Direction en degrés
    - **Longueur (m)**: Longueur en mètres
    - **de (m), à (m)**: Profondeur de début et fin
    - **Épaisseur (m)**: Épaisseur en mètres
    - **Moyenne U (ppm), Max U (ppm)**: Teneurs en uranium
    - **Lithologie**: Type de roche
    
    ### Fonctionnalités:
    - 🎯 **Modélisation 3D** avec machine learning
    - 💎 **Identification des corps minéralisés**
    - 🧪 **Analyse géologique** par lithologie
    - 📈 **Évaluation des réserves** et optimisation économique
    - 📊 **Visualisations interactives** en 3D
    """)

# Footer
st.markdown("---")
st.markdown(
    "Développé pour la modélisation géologique 3D | "
    "Utilise Streamlit, Plotly, Scikit-learn et Pandas"
)
