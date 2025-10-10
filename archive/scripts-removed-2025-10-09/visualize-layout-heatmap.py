#!/usr/bin/env python3

import json
from pathlib import Path

class Colors:
    END = '\033[0m'
    BOLD = '\033[1m'

def load_features(run_id):
    """Load and extract layout features"""
    vector_path = Path(f"artifacts/{run_id}/vector_data.json")
    with open(vector_path) as f:
        data = json.load(f)

    interpretable = data['globalStyleVec']['interpretable']
    feature_names = data['globalStyleVec']['metadata']['featureNames']

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

def get_color_for_value(value):
    """Return ANSI color based on value intensity"""
    if value >= 0.8:
        return '\033[48;5;196m'  # Dark red background
    elif value >= 0.6:
        return '\033[48;5;208m'  # Orange background
    elif value >= 0.4:
        return '\033[48;5;226m'  # Yellow background
    elif value >= 0.2:
        return '\033[48;5;51m'   # Cyan background
    else:
        return '\033[48;5;21m'   # Dark blue background

def main():
    sites = [
        ("2025-10-02T13-03-18-205Z_4b76f711_stripe-com", "Stripe"),
        ("2025-10-02T13-03-58-115Z_03ad24ee_monzo-com", "Monzo"),
        ("2025-10-02T13-09-20-742Z_14fe0555_cnn-com", "CNN"),
        ("2025-10-02T13-06-26-845Z_2e4c21d2_dawnlabs-co", "Dawn Labs"),
        ("2025-10-02T15-25-23-992Z_dcbf8dbb_bbc-co-uk", "BBC"),
        ("2025-10-02T13-08-22-753Z_1f20dfb8_apple-com", "Apple"),
    ]

    all_features = {}
    for run_id, name in sites:
        try:
            all_features[name] = load_features(run_id)
        except:
            continue

    if not all_features:
        print("No features loaded")
        return

    # Get feature names
    feature_list = [
        ('typo_hierarchy_depth', 'Hierarchy'),
        ('typo_weight_contrast', 'Weight'),
        ('spacing_density_score', 'Density'),
        ('spacing_whitespace_ratio', 'Whitespace'),
        ('spacing_padding_consistency', 'Padding'),
        ('spacing_image_text_balance', 'Img/Text'),
        ('shape_border_heaviness', 'Borders'),
        ('shape_shadow_depth', 'Shadows'),
        ('shape_grouping_strength', 'Grouping'),
        ('shape_compositional_complexity', 'Complexity'),
        ('brand_color_saturation_energy', 'Saturation'),
        ('brand_color_role_distinction', 'ColorRole'),
    ]

    site_names = list(all_features.keys())

    print(f"\n{Colors.BOLD}Layout Features Heatmap{Colors.END}")
    print(f"{Colors.BOLD}(0.0-0.2: Blue → 0.2-0.4: Cyan → 0.4-0.6: Yellow → 0.6-0.8: Orange → 0.8-1.0: Red){Colors.END}\n")

    # Header
    print(f"{'Feature':<15}", end='')
    for site in site_names:
        print(f"{site:^12}", end='')
    print()
    print("─" * (15 + 12 * len(site_names)))

    # Print heatmap
    for feature_key, feature_label in feature_list:
        print(f"{feature_label:<15}", end='')

        for site in site_names:
            if feature_key in all_features[site]:
                value = all_features[site][feature_key]
                color = get_color_for_value(value)
                print(f"{color}{value:^12.2f}{Colors.END}", end='')
            else:
                print(f"{'—':^12}", end='')
        print()

    print("\n" + "─" * (15 + 12 * len(site_names)))

    # Legend
    print(f"\n{Colors.BOLD}Interpretation Guide:{Colors.END}")
    print(f"  • {get_color_for_value(0.9)} HIGH {Colors.END} (0.8-1.0): Feature is strongly present")
    print(f"  • {get_color_for_value(0.5)} MED  {Colors.END} (0.4-0.6): Feature is moderately present")
    print(f"  • {get_color_for_value(0.1)} LOW  {Colors.END} (0.0-0.2): Feature is minimally present")

    # Find distinctive patterns
    print(f"\n{Colors.BOLD}Distinctive Patterns:{Colors.END}\n")

    # Stripe
    stripe_features = all_features.get('Stripe', {})
    print(f"{Colors.BOLD}Stripe:{Colors.END} High shadows ({stripe_features.get('shape_shadow_depth', 0):.2f}), "
          f"High complexity ({stripe_features.get('shape_compositional_complexity', 0):.2f}), "
          f"Low padding consistency ({stripe_features.get('spacing_padding_consistency', 0):.2f})")

    # Monzo
    monzo_features = all_features.get('Monzo', {})
    print(f"{Colors.BOLD}Monzo:{Colors.END} High padding consistency ({monzo_features.get('spacing_padding_consistency', 0):.2f}), "
          f"Very flat ({monzo_features.get('shape_shadow_depth', 0):.2f} shadows), "
          f"High whitespace ({monzo_features.get('spacing_whitespace_ratio', 0):.2f})")

    # CNN
    cnn_features = all_features.get('CNN', {})
    print(f"{Colors.BOLD}CNN:{Colors.END} High image/text balance ({cnn_features.get('spacing_image_text_balance', 0):.2f}), "
          f"Flat hierarchy ({cnn_features.get('typo_hierarchy_depth', 0):.2f}), "
          f"Flat design ({cnn_features.get('shape_shadow_depth', 0):.2f} shadows)")

    print()

if __name__ == "__main__":
    main()
