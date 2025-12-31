/* script.js — clean TA diagnostic wheel (robust spacing + readable labels) */
/* global d3 */

(() => {
  const errEl = document.getElementById("err");
  const svgEl = document.getElementById("chart");
  const tt = document.getElementById("tt");

  const showErr = (msg) => {
    if (!errEl) return;
    errEl.style.display = "block";
    errEl.textContent = msg;
  };

  if (!window.d3) {
    showErr("D3 did not load. Check the D3 script tag in index.html.");
    return;
  }
  if (!svgEl) {
    showErr('Missing <svg id="chart"> in index.html.');
    return;
  }

  // ---------- Data (labels from your image) ----------
  const QUADRANTS = [
    {
      name: "OPERATING MODEL",
      key: "Operating Model",
      colors: ["#b0ff00", "#00f88f"], // secondary -> primary
      dims: [
        { label: "TA Strategy", score: 2.5 },
        { label: "Team Capability", score: 3.0 },
        { label: "Hiring Manager Capability", score: 1.0 },
        { label: "Investment", score: 4.2 },
        { label: "Quality of Hire", score: 2.2 },
        { label: "Workforce Planning", score: 3.8 },
        { label: "Agility", score: 2.9 },
        { label: "Sourcing", score: 4.6 },
      ],
    },
    {
      name: "BRAND & EXPERIENCE",
      key: "Brand & Experience",
      colors: ["#ffb500", "#ffdb00"],
      dims: [
        { label: "EVP", score: 3.2 },
        { label: "Attraction", score: 2.4 },
        { label: "Employer Brand", score: 4.8 },
        { label: "Candidate Experience", score: 1.9 },
        { label: "DE&I Plan", score: 2.7 },
        { label: "Internal Experience", score: 3.6 },
      ],
    },
    {
      name: "DATA",
      key: "Data",
      colors: ["#ff4d3f", "#ff6600"],
      dims: [
        { label: "Data", score: 4.1 },
        { label: "Market Insights", score: 2.0 },
        { label: "Processes", score: 3.3 },
        { label: "Compliance", score: 1.2 },
        { label: "Selection", score: 4.7 },
      ],
    },
    {
      name: "COST",
      key: "Cost",
      colors: ["#5599e9", "#00ddff"],
      dims: [
        { label: "Cost Transparency", score: 3.5 },
        { label: "Cost Efficiency", score: 2.0 },
        { label: "Governance", score: 4.0 },
        { label: "ROI", score: 1.5 },
      ],
    },
  ];

  // ---------- Tooltip helpers ----------
  const ttShow = (event, html) => {
    if (!tt) return;
    tt.innerHTML = html;
    tt.style.opacity = "1";
    tt.style.position = "fixed";
    tt.style.left = `${event.clientX + 12}px`;
    tt.style.top = `${event.clientY + 12}px`;
    tt.style.pointerEvents = "none";
    tt.style.zIndex = "9999";
    tt.style.background = "rgba(0,0,0,0.75)";
    tt.style.border = "1px solid rgba(255,255,255,0.14)";
    tt.style.borderRadius = "12px";
    tt.style.padding = "10px 12px";
    tt.style.color = "#fff";
    tt.style.fontFamily =
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    tt.style.fontSize = "12px";
  };
  const ttHide = () => {
    if (!tt) return;
    tt.style.opacity = "0";
  };

  // ---------- Render ----------
  render();

  function render() {
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const W = 800;
    const H = 800;

    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const cx = W / 2;
    const cy = H / 2;

    const root = svg
      .append("g")
      .attr("transform", `translate(${cx},${cy})`);

    // Build flattened segment list
    const segments = [];
    QUADRANTS.forEach((q) => {
      q.dims.forEach((d) => {
        segments.push({
          quadrantKey: q.key,
          quadrantName: q.name,
          colors: q.colors,
          label: d.label,
          score: d.score,
        });
      });
    });

    const N = segments.length;
    const maxScore = 5;

    // --- Geometry (tuned for breathing room) ---
    const outerR = 270;          // overall wheel radius for rings
    const ringGap = 10;          // spacing between rings
    const innerDonutR = 105;     // center donut radius (where 3.0 sits)
    const donutStrokeR = innerDonutR + 18;

    const barInnerR = donutStrokeR + 18;         // where bars start
    const barOuterMax = outerR - 55;             // bar max to leave space for labels/scores
    const scoreR = outerR - 20;                  // score numbers ring (inside label ring)
    const labelR = outerR + 28;                  // label ring (outside)
    const gridR = outerR + 2;

    const step = (Math.PI * 2) / N;

    // Start at top (12 o'clock): -90deg
    const startAngle = -Math.PI / 2;

    segments.forEach((s, i) => {
      s.i = i;
      s.a0 = startAngle + i * step;
      s.a1 = startAngle + (i + 1) * step;
      s.am = (s.a0 + s.a1) / 2;
    });

    // Gradients per quadrant
    const defs = svg.append("defs");
    const gradIdByQuad = new Map();

    QUADRANTS.forEach((q) => {
      const id = `grad_${q.key.replace(/[^a-z0-9]/gi, "")}`;
      gradIdByQuad.set(q.key, id);

      const lg = defs
        .append("linearGradient")
        .attr("id", id)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

      lg.append("stop").attr("offset", "0%").attr("stop-color", q.colors[0]);
      lg.append("stop").attr("offset", "100%").attr("stop-color", q.colors[1]);
    });

    // Subtle outer ring grid
    root.append("circle")
      .attr("r", gridR)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.10)")
      .attr("stroke-width", 1);

    root.append("circle")
      .attr("r", barOuterMax)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.07)")
      .attr("stroke-width", 1);

    // Center donut stroke ring segmented by quadrant
    drawQuadrantRing(root, segments, donutStrokeR, 7, ringGap);

    // Bars
    const barScale = d3.scaleLinear()
      .domain([0, maxScore])
      .range([barInnerR, barOuterMax]);

    const barArc = d3.arc()
      .cornerRadius(7);

    root.append("g")
      .selectAll("path.bar")
      .data(segments)
      .enter()
      .append("path")
      .attr("class", "bar")
      .attr("d", (d) => barArc({
        innerRadius: barInnerR,
        outerRadius: barScale(d.score),
        startAngle: d.a0 + 0.012,
        endAngle: d.a1 - 0.012
      }))
      .attr("fill", (d) => `url(#${gradIdByQuad.get(d.quadrantKey)})`)
      .attr("stroke", "rgba(0,0,0,0.55)")
      .attr("stroke-width", 2)
      .on("mousemove", (event, d) => {
        ttShow(event, `<b>${d.label}</b><br>${d.quadrantKey}: <b>${d.score.toFixed(1)}</b> / 5`);
      })
      .on("mouseleave", ttHide);

    // Scores (around the wheel)
    root.append("g")
      .selectAll("text.score")
      .data(segments)
      .enter()
      .append("text")
      .attr("class", "score")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "rgba(255,255,255,0.90)")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("x", (d) => Math.cos(d.am) * scoreR)
      .attr("y", (d) => Math.sin(d.am) * scoreR)
      .text((d) => d.score.toFixed(1));

    // Labels (readable orientation)
    root.append("g")
      .selectAll("text.label")
      .data(segments)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "rgba(255,255,255,0.96)")
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", (d) => (Math.cos(d.am) >= 0 ? "start" : "end"))
      .attr("transform", (d) => {
        const x = Math.cos(d.am) * labelR;
        const y = Math.sin(d.am) * labelR;

        // Rotate text so it follows the circle but stays upright
        let rot = (d.am * 180) / Math.PI + 90;
        if (rot > 90 && rot < 270) rot += 180;

        return `translate(${x},${y}) rotate(${rot})`;
      })
      .text((d) => d.label)
      .on("mousemove", (event, d) => {
        ttShow(event, `<b>${d.label}</b><br>${d.quadrantKey}: <b>${d.score.toFixed(1)}</b> / 5`);
      })
      .on("mouseleave", ttHide);

    // Quadrant titles (straight, inside ring — avoids the broken curved text)
    drawQuadrantTitles(root, segments, innerDonutR + 40);

    // Center donut + bold score
    root.append("circle")
      .attr("r", innerDonutR)
      .attr("fill", "rgba(233,238,245,0.05)")
      .attr("stroke", "rgba(233,238,245,0.12)")
      .attr("stroke-width", 1);

    const overall = d3.mean(segments, (d) => d.score) ?? 0;

    root.append("text")
      .attr("class", "centerText")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("y", -6)
      .attr("fill", "#fff")
      .attr("font-size", 84)
      .attr("font-weight", 800)
      .attr("paint-order", "stroke")
      .attr("stroke", "rgba(0,0,0,0.55)")
      .attr("stroke-width", 4)
      .text(overall.toFixed(1));

    root.append("text")
      .attr("class", "centerSub")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("y", 44)
      .attr("fill", "rgba(255,255,255,0.72)")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("letter-spacing", 4)
      .text("OVERALL");
  }

  // Draw a segmented colored ring around the center (one segment per quadrant span)
  function drawQuadrantRing(root, segments, r, strokeWidth, gap) {
    // Identify quadrant ranges by index span
    const ranges = [];
    let i = 0;
    while (i < segments.length) {
      const key = segments[i].quadrantKey;
      let j = i;
      while (j < segments.length && segments[j].quadrantKey === key) j++;
      ranges.push({ key, a0: segments[i].a0, a1: segments[j - 1].a1 });
      i = j;
    }

    const arc = d3.arc()
      .innerRadius(r)
      .outerRadius(r);

    ranges.forEach((seg) => {
      const colors = QUADRANTS.find(q => q.key === seg.key)?.colors || ["#fff", "#fff"];

      root.append("path")
        .attr("d", arc({ startAngle: seg.a0 + 0.02, endAngle: seg.a1 - 0.02 }))
        .attr("fill", "none")
        .attr("stroke", colors[1])
        .attr("stroke-width", strokeWidth)
        .attr("stroke-linecap", "round");
    });

    // thin dark separator ring to create breathing room
    root.append("circle")
      .attr("r", r - (gap / 2))
      .attr("fill", "none")
      .attr("stroke", "rgba(0,0,0,0.65)")
      .attr("stroke-width", gap);
  }

  // Straight quadrant titles placed around the inner ring
  function drawQuadrantTitles(root, segments, titleR) {
    // quadrant mid-angles
    const mids = [];
    let i = 0;
    while (i < segments.length) {
      const key = segments[i].quadrantKey;
      const name = segments[i].quadrantName;
      let j = i;
      while (j < segments.length && segments[j].quadrantKey === key) j++;
      const a0 = segments[i].a0;
      const a1 = segments[j - 1].a1;
      mids.push({ key, name, am: (a0 + a1) / 2 });
      i = j;
    }

    root.append("g")
      .selectAll("text.qtitle")
      .data(mids)
      .enter()
      .append("text")
      .attr("class", "qtitle")
      .attr("font-size", 11)
      .attr("font-weight", 700)
      .attr("letter-spacing", 2)
      .attr("fill", "rgba(255,255,255,0.92)")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("transform", (d) => {
        const x = Math.cos(d.am) * titleR;
        const y = Math.sin(d.am) * titleR;
        let rot = (d.am * 180) / Math.PI + 90;
        if (rot > 90 && rot < 270) rot += 180;
        return `translate(${x},${y}) rotate(${rot})`;
      })
      .text((d) => d.name);
  }
})();
