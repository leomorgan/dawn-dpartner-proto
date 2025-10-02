#!/usr/bin/env python3

import json
import sys
from pathlib import Path
import statistics

# ANSI color codes
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def load_vector_data(run_id):
    """Load vector data from artifacts directory"""
    vector_path = Path(f"artifacts/{run_id}/vector_data.json")
    if not vector_path.exists():
        raise FileNotFoundError(f"Vector data not found: {vector_path}")

    with open(vector_path) as f:
        data = json.load(f)

    return data

def extract_layout_features(vector_data):
    """Extract the 12 layout features from the 64D interpretable vector"""
    interpretable = vector_data['globalStyleVec']['interpretable']
    feature_names = vector_data['globalStyleVec']['metadata']['featureNames']

    # Map feature indices to names
    features = {}
    for i, name in enumerate(feature_names):
        if any(keyword in name for keyword in [
            'hierarchy_depth', 'weight_contrast',
            'density_score', 'whitespace_ratio', 'padding_consistency', 'image_text_balance',
            'border_heaviness', 'shadow_depth', 'grouping_strength', 'compositional_complexity',
            'saturation_energy', 'role_distinction'
        ]):
            features[name] = float(interpretable[str(i)])

    return features

def print_feature_bar(name, value, min_label, max_label, color=Colors.BLUE):
    """Print a visual progress bar for a feature"""
    bar_length = 40
    filled = int(value * bar_length)
    bar = '█' * filled + '░' * (bar_length - filled)

    print(f"  {name:<40} {value:.3f}")
    print(f"    {color}{bar}{Colors.END}")
    print(f"    {min_label:<38} {max_label:>38}")

def analyze_site(run_id, site_name):
    """Analyze and display layout features for a single site"""
    try:
        vector_data = load_vector_data(run_id)
        features = extract_layout_features(vector_data)

        print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.HEADER}{site_name.upper()}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.END}\n")

        # Typography & Hierarchy
        print(f"{Colors.BOLD}{Colors.CYAN}📝 Typography & Hierarchy{Colors.END}")
        print_feature_bar(
            "Hierarchy Depth",
            features.get('typo_hierarchy_depth', 0),
            "Flat", "Deep Hierarchy",
            Colors.CYAN
        )
        print_feature_bar(
            "Weight Contrast",
            features.get('typo_weight_contrast', 0),
            "Uniform", "High Contrast",
            Colors.CYAN
        )

        # Spacing & Density
        print(f"\n{Colors.BOLD}{Colors.BLUE}📏 Spacing & Density{Colors.END}")
        print_feature_bar(
            "Visual Density",
            features.get('spacing_density_score', 0),
            "Minimal", "Dense",
            Colors.BLUE
        )
        print_feature_bar(
            "Whitespace Breathing",
            features.get('spacing_whitespace_ratio', 0),
            "Tight", "Generous",
            Colors.BLUE
        )
        print_feature_bar(
            "Padding Consistency",
            features.get('spacing_padding_consistency', 0),
            "Variable", "Systematic",
            Colors.BLUE
        )
        print_feature_bar(
            "Image/Text Balance",
            features.get('spacing_image_text_balance', 0),
            "Text-Heavy", "Image-Heavy",
            Colors.BLUE
        )

        # Shape & Composition
        print(f"\n{Colors.BOLD}{Colors.GREEN}🎨 Shape & Composition{Colors.END}")
        print_feature_bar(
            "Border Heaviness",
            features.get('shape_border_heaviness', 0),
            "Minimal", "Heavy Borders",
            Colors.GREEN
        )
        print_feature_bar(
            "Shadow Depth",
            features.get('shape_shadow_depth', 0),
            "Flat", "Elevated",
            Colors.GREEN
        )
        print_feature_bar(
            "Grouping Strength",
            features.get('shape_grouping_strength', 0),
            "Loose", "Tight Groups",
            Colors.GREEN
        )
        print_feature_bar(
            "Compositional Complexity",
            features.get('shape_compositional_complexity', 0),
            "Simple", "Complex",
            Colors.GREEN
        )

        # Color Expression
        print(f"\n{Colors.BOLD}{Colors.YELLOW}🌈 Color Expression{Colors.END}")
        print_feature_bar(
            "Saturation Energy",
            features.get('brand_color_saturation_energy', 0),
            "Muted", "Vibrant",
            Colors.YELLOW
        )
        print_feature_bar(
            "Role Distinction",
            features.get('brand_color_role_distinction', 0),
            "Subtle", "High Contrast",
            Colors.YELLOW
        )

        return features

    except Exception as e:
        print(f"{Colors.RED}Error analyzing {site_name}: {e}{Colors.END}")
        return None

def compare_sites(sites_data):
    """Create a comparison table and analysis"""
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}COMPARATIVE ANALYSIS{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.END}\n")

    # Collect all feature names
    all_features = set()
    for site_name, features in sites_data.items():
        if features:
            all_features.update(features.keys())

    all_features = sorted(all_features)

    # Simplified feature names for table
    feature_labels = {
        'typo_hierarchy_depth': 'Hierarchy',
        'typo_weight_contrast': 'Weight',
        'spacing_density_score': 'Density',
        'spacing_whitespace_ratio': 'Whitespace',
        'spacing_padding_consistency': 'Padding',
        'spacing_image_text_balance': 'Img/Text',
        'shape_border_heaviness': 'Borders',
        'shape_shadow_depth': 'Shadows',
        'shape_grouping_strength': 'Grouping',
        'shape_compositional_complexity': 'Complexity',
        'brand_color_saturation_energy': 'Saturation',
        'brand_color_role_distinction': 'ColorRole'
    }

    # Print comparison table
    site_names = list(sites_data.keys())
    print(f"{Colors.BOLD}{'Feature':<20} {site_names[0]:>12} {site_names[1]:>12} {site_names[2]:>12}   Δ(max-min){Colors.END}")
    print("─" * 80)

    insights = []

    for feature in all_features:
        label = feature_labels.get(feature, feature)
        values = []
        for site in site_names:
            if sites_data[site] and feature in sites_data[site]:
                values.append(sites_data[site][feature])
            else:
                values.append(0.0)

        variance = max(values) - min(values)

        # Color code by variance (high variance = good differentiation)
        if variance > 0.3:
            color = Colors.GREEN
            marker = "✓"
        elif variance > 0.1:
            color = Colors.YELLOW
            marker = "~"
        else:
            color = Colors.RED
            marker = "✗"

        print(f"{label:<20} {values[0]:>12.3f} {values[1]:>12.3f} {values[2]:>12.3f}   {color}{variance:>6.3f} {marker}{Colors.END}")

        # Collect insights
        if variance > 0.3:
            max_idx = values.index(max(values))
            min_idx = values.index(min(values))
            insights.append({
                'feature': label,
                'max_site': site_names[max_idx],
                'max_val': values[max_idx],
                'min_site': site_names[min_idx],
                'min_val': values[min_idx],
                'variance': variance
            })

    # Print insights
    print(f"\n{Colors.BOLD}{Colors.HEADER}KEY INSIGHTS{Colors.END}\n")

    insights.sort(key=lambda x: x['variance'], reverse=True)

    for i, insight in enumerate(insights[:5], 1):
        print(f"{Colors.BOLD}{i}. {insight['feature']}{Colors.END}")
        print(f"   {Colors.GREEN}{insight['max_site']}{Colors.END} has {insight['max_val']:.1%} vs "
              f"{Colors.CYAN}{insight['min_site']}{Colors.END} at {insight['min_val']:.1%}")
        print(f"   Δ {insight['variance']:.3f} ({insight['variance']:.1%} difference)\n")

    # Design personality summary
    print(f"\n{Colors.BOLD}{Colors.HEADER}DESIGN PERSONALITY SUMMARY{Colors.END}\n")

    for site_name, features in sites_data.items():
        if not features:
            continue

        print(f"{Colors.BOLD}{site_name}:{Colors.END}")

        # Calculate personality traits
        traits = []

        if features.get('spacing_whitespace_ratio', 0) > 0.7:
            traits.append("Generous whitespace")
        elif features.get('spacing_whitespace_ratio', 0) < 0.4:
            traits.append("Tight spacing")

        if features.get('spacing_density_score', 0) > 0.8:
            traits.append("Dense content")
        elif features.get('spacing_density_score', 0) < 0.5:
            traits.append("Minimal content")

        if features.get('shape_shadow_depth', 0) > 0.3:
            traits.append("Elevated (shadows)")
        elif features.get('shape_shadow_depth', 0) < 0.1:
            traits.append("Flat design")

        if features.get('shape_border_heaviness', 0) > 0.3:
            traits.append("Heavy borders/dividers")
        elif features.get('shape_border_heaviness', 0) < 0.1:
            traits.append("Minimal borders")

        if features.get('brand_color_saturation_energy', 0) > 0.5:
            traits.append("Vibrant colors")
        elif features.get('brand_color_saturation_energy', 0) < 0.2:
            traits.append("Muted palette")

        if features.get('spacing_padding_consistency', 0) > 0.7:
            traits.append("Systematic spacing")
        elif features.get('spacing_padding_consistency', 0) < 0.3:
            traits.append("Variable spacing")

        if features.get('spacing_image_text_balance', 0) > 0.5:
            traits.append("Image-heavy")
        elif features.get('spacing_image_text_balance', 0) < 0.1:
            traits.append("Text-focused")

        print(f"  • {', '.join(traits)}\n")

def main():
    # Site configurations
    sites = [
        ("2025-10-02T13-03-18-205Z_4b76f711_stripe-com", "Stripe"),
        ("2025-10-02T13-03-58-115Z_03ad24ee_monzo-com", "Monzo"),
        ("2025-10-02T13-09-20-742Z_14fe0555_cnn-com", "CNN")
    ]

    # Analyze each site
    sites_data = {}
    for run_id, site_name in sites:
        features = analyze_site(run_id, site_name)
        sites_data[site_name] = features

    # Compare sites
    if len(sites_data) > 1:
        compare_sites(sites_data)

if __name__ == "__main__":
    main()
