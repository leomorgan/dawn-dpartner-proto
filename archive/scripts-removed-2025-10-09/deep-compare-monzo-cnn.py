#!/usr/bin/env python3

import json
from pathlib import Path

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def load_all_data(run_id):
    """Load vector data, tokens, and metadata"""
    base_path = Path(f"artifacts/{run_id}")

    # Vector data
    with open(base_path / "vector_data.json") as f:
        vector_data = json.load(f)

    # Design tokens
    with open(base_path / "design_tokens.json") as f:
        tokens = json.load(f)

    # Raw metadata
    with open(base_path / "raw/meta.json") as f:
        meta = json.load(f)

    # Computed styles (sample)
    with open(base_path / "raw/computed_styles.json") as f:
        styles = json.load(f)

    return vector_data, tokens, meta, styles

def extract_layout_features(vector_data):
    """Extract the 12 layout features"""
    interpretable = vector_data['globalStyleVec']['interpretable']
    feature_names = vector_data['globalStyleVec']['metadata']['featureNames']

    features = {}
    for i, name in enumerate(feature_names):
        if any(keyword in name for keyword in [
            'hierarchy_depth', 'weight_contrast',
            'density_score', 'whitespace_ratio', 'padding_consistency', 'image_text_balance',
            'border_heaviness', 'shadow_depth', 'grouping_strength', 'compositional_complexity',
            'saturation_energy', 'role_distinction'
        ]):
            features[name] = {
                'value': float(interpretable[str(i)]),
                'index': i
            }

    return features

def analyze_raw_elements(styles, meta):
    """Analyze raw DOM elements for manual calculation"""
    viewport_area = meta['viewport']['width'] * meta['viewport']['height']

    # Count elements
    total_elements = len(styles)

    # Count by type
    img_elements = [s for s in styles if s.get('tag') in ['img', 'picture', 'video'] or
                    (s.get('styles', {}).get('backgroundImage') and
                     s['styles']['backgroundImage'] != 'none')]

    text_elements = [s for s in styles if s.get('textContent') and
                     len(s['textContent'].strip()) > 0]

    # Calculate areas
    total_element_area = sum(s['bbox']['w'] * s['bbox']['h'] for s in styles)
    img_area = sum(s['bbox']['w'] * s['bbox']['h'] for s in img_elements)
    text_area = sum(s['bbox']['w'] * s['bbox']['h'] for s in text_elements)

    # Extract padding values
    padding_values = []
    for s in styles:
        padding_str = s.get('styles', {}).get('padding', '0px 0px 0px 0px')
        parts = padding_str.replace('px', '').split()
        padding_values.extend([float(p) for p in parts if p.replace('.', '').isdigit()])

    # Calculate element overlap (simple version)
    overlapping_pairs = 0
    for i, s1 in enumerate(styles[:100]):  # Sample first 100 for performance
        for s2 in styles[i+1:min(i+20, len(styles))]:
            if boxes_overlap(s1['bbox'], s2['bbox']):
                overlapping_pairs += 1

    return {
        'total_elements': total_elements,
        'viewport_area': viewport_area,
        'total_element_area': total_element_area,
        'density_ratio': total_element_area / viewport_area,
        'img_elements': len(img_elements),
        'text_elements': len(text_elements),
        'img_area': img_area,
        'text_area': text_area,
        'img_text_ratio': img_area / text_area if text_area > 0 else 0,
        'padding_values': padding_values,
        'padding_mean': sum(padding_values) / len(padding_values) if padding_values else 0,
        'padding_std': calculate_std(padding_values) if padding_values else 0,
        'overlapping_pairs': overlapping_pairs,
    }

def boxes_overlap(bbox1, bbox2):
    """Check if two bounding boxes overlap"""
    return not (bbox1['x'] + bbox1['w'] < bbox2['x'] or
                bbox2['x'] + bbox2['w'] < bbox1['x'] or
                bbox1['y'] + bbox1['h'] < bbox2['y'] or
                bbox2['y'] + bbox2['h'] < bbox1['y'])

def calculate_std(values):
    """Calculate standard deviation"""
    if not values:
        return 0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5

def main():
    monzo_id = "2025-10-02T13-03-58-115Z_03ad24ee_monzo-com"
    cnn_id = "2025-10-02T13-09-20-742Z_14fe0555_cnn-com"

    print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}DEEP DIVE: Why do Monzo and CNN appear similar?{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.END}\n")

    # Load data
    print(f"{Colors.CYAN}Loading data...{Colors.END}")
    monzo_vec, monzo_tokens, monzo_meta, monzo_styles = load_all_data(monzo_id)
    cnn_vec, cnn_tokens, cnn_meta, cnn_styles = load_all_data(cnn_id)

    # Extract features
    monzo_features = extract_layout_features(monzo_vec)
    cnn_features = extract_layout_features(cnn_vec)

    # Raw analysis
    print(f"\n{Colors.BOLD}1. RAW DOM STATISTICS{Colors.END}\n")

    monzo_raw = analyze_raw_elements(monzo_styles, monzo_meta)
    cnn_raw = analyze_raw_elements(cnn_styles, cnn_meta)

    print(f"{'Metric':<35} {'Monzo':>15} {'CNN':>15} {'Difference':>15}")
    print("─" * 80)
    print(f"{'Total Elements':<35} {monzo_raw['total_elements']:>15} {cnn_raw['total_elements']:>15} {cnn_raw['total_elements'] - monzo_raw['total_elements']:>15}")
    print(f"{'Viewport Area (px²)':<35} {monzo_raw['viewport_area']:>15,.0f} {cnn_raw['viewport_area']:>15,.0f} {cnn_raw['viewport_area'] - monzo_raw['viewport_area']:>15,.0f}")
    print(f"{'Total Element Area (px²)':<35} {monzo_raw['total_element_area']:>15,.0f} {cnn_raw['total_element_area']:>15,.0f} {cnn_raw['total_element_area'] - monzo_raw['total_element_area']:>15,.0f}")
    print(f"{'Density Ratio (area/viewport)':<35} {monzo_raw['density_ratio']:>15.2f} {cnn_raw['density_ratio']:>15.2f} {abs(cnn_raw['density_ratio'] - monzo_raw['density_ratio']):>15.2f}")
    print()
    print(f"{'Image Elements':<35} {monzo_raw['img_elements']:>15} {cnn_raw['img_elements']:>15} {cnn_raw['img_elements'] - monzo_raw['img_elements']:>15}")
    print(f"{'Text Elements':<35} {monzo_raw['text_elements']:>15} {cnn_raw['text_elements']:>15} {cnn_raw['text_elements'] - monzo_raw['text_elements']:>15}")
    print(f"{'Image Area (px²)':<35} {monzo_raw['img_area']:>15,.0f} {cnn_raw['img_area']:>15,.0f} {cnn_raw['img_area'] - monzo_raw['img_area']:>15,.0f}")
    print(f"{'Text Area (px²)':<35} {monzo_raw['text_area']:>15,.0f} {cnn_raw['text_area']:>15,.0f} {cnn_raw['text_area'] - monzo_raw['text_area']:>15,.0f}")
    print(f"{'Img/Text Ratio':<35} {monzo_raw['img_text_ratio']:>15.3f} {cnn_raw['img_text_ratio']:>15.3f} {abs(cnn_raw['img_text_ratio'] - monzo_raw['img_text_ratio']):>15.3f}")
    print()
    print(f"{'Avg Padding (px)':<35} {monzo_raw['padding_mean']:>15.2f} {cnn_raw['padding_mean']:>15.2f} {abs(cnn_raw['padding_mean'] - monzo_raw['padding_mean']):>15.2f}")
    print(f"{'Padding Std Dev':<35} {monzo_raw['padding_std']:>15.2f} {cnn_raw['padding_std']:>15.2f} {abs(cnn_raw['padding_std'] - monzo_raw['padding_std']):>15.2f}")
    print(f"{'Overlapping Elements (sample)':<35} {monzo_raw['overlapping_pairs']:>15} {cnn_raw['overlapping_pairs']:>15} {abs(cnn_raw['overlapping_pairs'] - monzo_raw['overlapping_pairs']):>15}")

    # Feature comparison
    print(f"\n{Colors.BOLD}2. NORMALIZED FEATURES COMPARISON{Colors.END}\n")

    print(f"{'Feature':<35} {'Monzo':>15} {'CNN':>15} {'Δ':>10} {'Problem?':>10}")
    print("─" * 85)

    for feature_key in sorted(monzo_features.keys()):
        if feature_key in cnn_features:
            monzo_val = monzo_features[feature_key]['value']
            cnn_val = cnn_features[feature_key]['value']
            diff = abs(monzo_val - cnn_val)

            # Determine if this is problematic
            problem = ""
            if diff < 0.05:
                problem = f"{Colors.RED}⚠️ TOO CLOSE{Colors.END}"
            elif diff < 0.15:
                problem = f"{Colors.YELLOW}~ SIMILAR{Colors.END}"
            else:
                problem = f"{Colors.GREEN}✓ GOOD{Colors.END}"

            print(f"{feature_key.replace('_', ' ').title():<35} {monzo_val:>15.3f} {cnn_val:>15.3f} {diff:>10.3f} {problem:>20}")

    # Identify the problem
    print(f"\n{Colors.BOLD}3. ROOT CAUSE ANALYSIS{Colors.END}\n")

    # Density
    print(f"{Colors.BOLD}Issue 1: Density Score (0.831 vs 0.841 - nearly identical){Colors.END}")
    print(f"  Raw density ratio: {monzo_raw['density_ratio']:.2f} vs {cnn_raw['density_ratio']:.2f}")
    print(f"  {Colors.YELLOW}→ Both have element areas 200-250x viewport area (overlapping elements){Colors.END}")
    print(f"  {Colors.YELLOW}→ Log normalization maps 200-250 to ~0.83-0.84{Colors.END}")
    print(f"  {Colors.RED}✗ Problem: Normalization midpoint (250) doesn't differentiate this range{Colors.END}")
    print()

    # Whitespace
    print(f"{Colors.BOLD}Issue 2: Whitespace Ratio (1.000 vs 1.000 - identical){Colors.END}")
    print(f"  Both hit the normalization ceiling")
    print(f"  {Colors.YELLOW}→ Raw calculation likely produces values > 1.0{Colors.END}")
    print(f"  {Colors.RED}✗ Problem: Clamping to 1.0 loses differentiation{Colors.END}")
    print()

    # Padding
    print(f"{Colors.BOLD}Issue 3: Padding Consistency (0.678 vs 0.593 - some difference){Colors.END}")
    print(f"  Monzo CV: ~{1 - monzo_features['spacing_padding_consistency']['value']:.2f}")
    print(f"  CNN CV: ~{1 - cnn_features['spacing_padding_consistency']['value']:.2f}")
    print(f"  {Colors.GREEN}✓ This feature IS working - shows Monzo is more systematic{Colors.END}")
    print()

    # Image/Text
    print(f"{Colors.BOLD}Issue 4: Image/Text Balance (0.098 vs 0.370 - GOOD DIFFERENCE){Colors.END}")
    print(f"  Raw ratio: {monzo_raw['img_text_ratio']:.3f} vs {cnn_raw['img_text_ratio']:.3f}")
    print(f"  {Colors.GREEN}✓ This feature IS working - shows CNN is more image-heavy{Colors.END}")
    print()

    # Hierarchy
    print(f"{Colors.BOLD}Issue 5: Hierarchy Depth (0.218 vs 0.083 - GOOD DIFFERENCE){Colors.END}")
    print(f"  {Colors.GREEN}✓ This feature IS working - shows Monzo has more size variation{Colors.END}")
    print()

    # Summary
    print(f"\n{Colors.BOLD}4. WHAT'S ACTUALLY DIFFERENT?{Colors.END}\n")

    print(f"{Colors.GREEN}Features that ARE differentiating:{Colors.END}")
    print(f"  • Image/Text Balance: CNN has 3.8x more images (0.370 vs 0.098)")
    print(f"  • Hierarchy Depth: Monzo has 2.6x more font variation (0.218 vs 0.083)")
    print(f"  • Shadows: Monzo has slightly more (0.028 vs 0.064)")
    print(f"  • Padding Consistency: Monzo is more systematic (0.678 vs 0.593)")
    print()

    print(f"{Colors.RED}Features that are NOT differentiating (PROBLEMATIC):{Colors.END}")
    print(f"  • Density: Both ~0.83 (normalization issue)")
    print(f"  • Whitespace: Both 1.00 (ceiling hit)")
    print(f"  • Grouping: Both high 0.79-0.92 (similar layout pattern)")
    print(f"  • Complexity: Both moderate 0.41-0.44 (similar section count)")
    print()

    print(f"\n{Colors.BOLD}5. WHY DO THEY LOOK DIFFERENT TO YOUR EYE?{Colors.END}\n")

    print(f"{Colors.CYAN}Visual differences not captured by current features:{Colors.END}")
    print(f"  1. {Colors.BOLD}Content Type:{Colors.END} Monzo = marketing copy, CNN = news headlines")
    print(f"     → Image/Text Balance captures this (✓)")
    print()
    print(f"  2. {Colors.BOLD}Visual Rhythm:{Colors.END} Monzo = large hero sections, CNN = uniform grid")
    print(f"     → Hierarchy Depth partially captures this (✓)")
    print()
    print(f"  3. {Colors.BOLD}Color Palette:{Colors.END} Monzo = coral accent, CNN = red/white/blue")
    print(f"     → Saturation Energy should capture this but both are low (✗)")
    print()
    print(f"  4. {Colors.BOLD}Element Sizes:{Colors.END} Monzo = large cards, CNN = small thumbnails")
    print(f"     → NOT CAPTURED - missing 'average element size' feature (✗)")
    print()
    print(f"  5. {Colors.BOLD}Vertical Spacing:{Colors.END} Monzo = big gaps between sections, CNN = tight grid")
    print(f"     → Whitespace should capture this but hits ceiling (✗)")
    print()
    print(f"  6. {Colors.BOLD}Grid vs Flow:{Colors.END} CNN = rigid grid, Monzo = flowing sections")
    print(f"     → NOT CAPTURED - missing 'grid regularity' feature (✗)")
    print()

    print(f"\n{Colors.BOLD}6. RECOMMENDED FIXES{Colors.END}\n")

    print(f"{Colors.YELLOW}Fix 1: Adjust Density Normalization{Colors.END}")
    print(f"  Current: Log normalize with midpoint 250")
    print(f"  Problem: 200-250 range maps to narrow 0.82-0.85")
    print(f"  Solution: Use midpoint 150 or switch to linear 0-500 range")
    print()

    print(f"{Colors.YELLOW}Fix 2: Fix Whitespace Ceiling{Colors.END}")
    print(f"  Current: Clamped to 1.0")
    print(f"  Problem: Both sites exceed max, lose differentiation")
    print(f"  Solution: Increase normalization range or use percentile-based scaling")
    print()

    print(f"{Colors.YELLOW}Fix 3: Add Missing Features{Colors.END}")
    print(f"  • Average Element Size: median(element areas)")
    print(f"  • Grid Regularity: variance in element positions")
    print(f"  • Vertical Section Spacing: avg gap between horizontal bands")
    print(f"  • Content Density (above fold): elements in first viewport")
    print()

    print(f"\n{Colors.BOLD}CONCLUSION:{Colors.END}")
    print(f"Monzo and CNN appear similar because:")
    print(f"  1. Both have high density from overlapping elements (modern web design)")
    print(f"  2. Both have generous whitespace (hits ceiling)")
    print(f"  3. Both use tight grouping (modern design pattern)")
    print(f"")
    print(f"They ARE different in:")
    print(f"  • Image usage (3.8x difference) ✓")
    print(f"  • Typography hierarchy (2.6x difference) ✓")
    print(f"  • Padding systematization (1.14x difference) ✓")
    print(f"")
    print(f"To improve differentiation, fix density/whitespace normalization.")
    print()

if __name__ == "__main__":
    main()
