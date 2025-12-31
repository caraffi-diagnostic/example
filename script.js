/* script.js — spaced radial diagnostic wheel (better breathing room + bold center score) */
/* global d3 */

(function () {
  const errEl = document.getElementById("err");
  const showErr = (msg) => {
    if (!errEl) return;
    errEl.style.display = "block";
    errEl.textContent = msg;
  };

  if (!window.d3) {
    showErr("ERROR: D3 did not load. Check your CDN link or network blockers.");
    return;
  }

  // Brandbook gradient pairs (secondary -> primary)
  const PALETTE = {
    cost:       { secondary: "#5599e9", primary: "#00ddff" }, // blue
    operating:  { secondary: "#b0ff00", primary: "#00f88f" }, // green
    experience: { secondary: "#ffb500", primary: "#ffdb00" }, // yellow
    data:       { secondary: "#ff4d3f", primary: "#ff6600" }  // orange
  };

  // Data (labels from your image)
  const quadrants = [
    {
      name: "Operating Model",
      grad: PALETTE.operating,
      dims: [
        { label: "TA Strategy", score: 2.5 },
        { label: "Team Capability", score: 3.0 },
        { label: "Hiring Manager Capability", score: 1.0 },
        { label: "Investment", score: 4.2 },
        { label: "Quality of Hire", score: 2.2 },
        { label: "Workforce Planning", score: 3.8 },
        { label: "Agility", score: 2.9 },
        { label: "Sourcing", score: 4.6 }
      ]
    },
    {
      name: "Brand & Experience",
      grad: PALETTE.experience,
      dims: [
        { label: "EVP", score: 3.2 },
        { label: "Attraction", score: 2.4 },
        { label: "Employer Brand", score: 4.8 },
        { label: "Candidate Experience", score: 1.9 },
        { label: "DE&I Plan", score: 2.7 },
        { label: "Internal Experience", score: 3.6 }
      ]
    },
    {
      name: "Data",
      grad: PALETTE.data,
      dims: [
        { label: "Data", score: 4.1 },
        { label: "Market Insights", score: 2.0 },
        { label: "Processes", score: 3.3 },
        { label: "Compliance", score: 1.2 },
        { label: "Selection", score: 4.7 }
      ]
    },
    {
      name: "Cost",
      grad: PALETTE.cost,
      dims: [
        { label: "Cost Transparency", score: 3.5 },
        { label: "Cost Efficiency", score: 2.0 },
        { label: "Governance", score: 4.0 },
        { label: "ROI", score: 1.5 }
      ]
    }
  ];

  // ---- Basic validation to avoid silent breakage ----
  const expected = { "Cost": 4, "Operating Model": 8, "Brand & Experience": 6, "Data": 5 };
  const mismatch = quadrants
    .map(q => ({ name: q.name, got: q.dims.length, want: expected[q.name] }))
    .filter(x => x.want != null && x.got !== x.want);

  if (mismatch.length) {
    showErr("SEGMENT COUNT MISMATCH: " + mismatch.map(m => `${m.name} got ${m.got} want ${m.want}`).join(" | "));
    return;
  }

  // Tooltip
  const tt = document.getElementById("tt");
  const showTT = (event, html) => {
    if (!tt) return;
    tt.innerHTML = html;
    tt.style.opacity = "1";
    tt.style.left = (event.clientX + 14) + "px";
    tt.style.top = (event.clientY + 14) + "px";
    tt.style.background = "rgba(0,0,0,0.75)";
    tt.style.color = "#fff";
    tt.style.padding = "10px 12px";
    tt.style.borderRadius = "12px";
    tt.style.border = "1px solid rgba(255,255,255,0.12)";
    tt.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    tt.style.fontSize = "12px";
    tt.style.pointerEvents = "none";
    tt.style.position = "fixed";
    tt.style.zIndex = "9999";
  };
  const hideTT = () => {
    if (!tt) return;
    tt.style.opacity = "0";
  };

  render();

  function render() {
    const svg = d3.select("#chart");
    svg.selectAll("*").remove(); // hard reset

    const W = 800, H = 800;
    const cx = W / 2, cy = H / 2;

    // -----------------------------
    // SPACING TUNING (less squished)
    // -----------------------------
    const maxScore = 5;

    // Bigger overall wheel + more room for labels
    const outerR = 285;

    // Slightly larger inner ring gives breathing room
    const innerR = 104;

    // Wedges sit further out from center
    const wedgeInnerR = innerR + 52;

    // Leave a buffer for label ring (so bars don’t crowd text)
    const wedgeOuterLimit = outerR - 36;

    // Outer score ring and label ring pushed further out
    const scoreR = outerR + 18;
    const labelR = outerR + 56;

    // Quadrant/category line ring
    const catLineR = innerR + 30;
    const catTextR = catLineR - 16;

    // Scale for wedge height
    const wedgeScale = d3.scaleLinear()
      .domain([0, maxScore])
      .range([wedgeInnerR, wedgeOuterLimit]);

    // Helpful geometry
    // angle = 0 at 12 o’clock, clockwise
    const polarXY = (angle, r) => [Math.sin(angle) * r, -Math.cos(angle) * r];

    const normalizeDeg = (deg) => ((deg + 180) % 360) - 180;

    // Flatten dimensions into segments while keeping quadrant grouping
    const segments = [];
    quadrants.forEach(q => q.dims.forEach(d => segments.push({ ...d, quadrant: q.name, grad: q.grad })));

    const N = segments.length;
    const step = (Math.PI * 2) / N;
    const start = 0; // 12 o'clock reference handled by polarXY

    // Add angles
    segments.forEach((d, i) => {
      d.i = i;
      d.a0 = start + i * step;
      d.a1 = start + (i + 1) * step;
      d.am = (d.a0 + d.a1) / 2;
    });

    // Root group centered
    const root = svg
      .attr("viewBox", `0 0 ${W} ${H}`)
      .append("g")
      .attr("transform", `translate(${cx},${cy})`);

    // Defs for gradients
    const defs = svg.append("defs");

    // One gradient per quadrant (reused)
    const gradIds = {};
    quadrants.forEach((q) => {
      const id = `grad_${q.name.replace(/[^a-z0-9]/gi, "")}`;
      gradIds[q.name] = id;

      const lg = defs.append("linearGradient")
        .attr("id", id)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

      lg.append("stop").attr("offset", "0%").attr("stop-color", q.grad.secondary);
      lg.append("stop").attr("offset", "100%").attr("stop-color", q.grad.primary);
    });

    // Soft background rings (subtle)
    root.append("circle")
      .attr("r", outerR + 4)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.10)")
      .attr("stroke-width", 1);

    root.append("circle")
      .attr("r", wedgeOuterLimit)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.08)")
      .attr("stroke-width", 1);

    // -----------------------------
    // Category (quadrant) arcs + text
    // -----------------------------
    // Determine start/end index per quadrant
    const quadRanges = [];
    let cursor = 0;
    quadrants.forEach((q) => {
      const count = q.dims.length;
      const first = cursor;
      const last = cursor + count - 1;
      const a0 = segments[first].a0;
      const a1 = segments[last].a1;
      quadRanges.push({ name: q.name, grad: q.grad, a0, a1 });
      cursor += count;
    });

    const catArc = d3.arc()
      .innerRadius(catLineR)
      .outerRadius(catLineR);

    quadRanges.forEach((q) => {
      const pathId = `catPath_${q.name.replace(/[^a-z0-9]/gi, "")}`;

      // Category line (colored)
      root.append("path")
        .attr("d", catArc({ startAngle: q.a0 + 0.01, endAngle: q.a1 - 0.01 }))
        .attr("fill", "none")
        .attr("stroke", q.grad.primary)
        .attr("stroke-width", 6)
        .attr("stroke-linecap", "round");

      // Invisible path for text
      root.append("path")
        .attr("id", pathId)
        .attr("d", d3.arc().innerRadius(catTextR).outerRadius(catTextR)({
          startAngle: q.a0 + 0.03,
          endAngle: q.a1 - 0.03
        }))
        .attr("fill", "none")
        .attr("stroke", "none");

      // Curved text on the category line
      root.append("text")
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .attr("letter-spacing", 2)
        .attr("fill", "rgba(255,255,255,0.9)")
        .append("textPath")
        .attr("href", `#${pathId}`)
        .attr("startOffset", "50%")
        .attr("text-anchor", "middle")
        .text(q.name.toUpperCase());
    });

    // -----------------------------
    // Wedges
    // -----------------------------
    const wedgeArc = d3.arc()
      .cornerRadius(6);

    const wedgeGroup = root.append("g").attr("class", "wedges");

    wedgeGroup.selectAll("path.wedge")
      .data(segments)
      .enter()
      .append("path")
      .attr("class", "wedge")
      .attr("d", (d) => wedgeArc({
        innerRadius: wedgeInnerR,
        outerRadius: wedgeScale(d.score),
        startAngle: d.a0 + 0.014,
        endAngle: d.a1 - 0.014
      }))
      .attr("fill", (d) => `url(#${gradIds[d.quadrant]})`)
      .attr("stroke", "rgba(0,0,0,0.55)")
      .attr("stroke-width", 2)
      .on("mousemove", (event, d) => {
        showTT(event, `<b>${d.quadrant}</b><br>${d.label}: <b>${d.score.toFixed(1)}</b> / 5`);
      })
      .on("mouseleave", hideTT);

    // -----------------------------
    // Outer score numbers
    // -----------------------------
    root.append("g")
      .selectAll("text.score")
      .data(segments)
      .enter()
      .append("text")
      .attr("class", "score")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "rgba(255,255,255,0.85)")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("transform", (d) => {
        const [x, y] = polarXY(d.am, scoreR);
        return `translate(${x},${y})`;
      })
      .text((d) => d.score.toFixed(1));

    // -----------------------------
    // Outer labels
    // -----------------------------
    root.append("g")
      .selectAll("text.label")
      .data(segments)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "rgba(255,255,255,0.95)")
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", (d) => {
        // Right side: start, left side: end
        const deg = normalizeDeg((d.am * 180) / Math.PI);
        return (deg > -90 && deg < 90) ? "start" : "end";
      })
      .attr("transform", (d) => {
        const deg = normalizeDeg((d.am * 180) / Math.PI);
        const [x, y] = polarXY(d.am, labelR);
        const rot = (deg > -90 && deg < 90) ? deg : deg + 180;
        return `translate(${x},${y}) rotate(${rot})`;
      })
      .text((d) => d.label)
      .on("mousemove", (event, d) => {
        showTT(event, `<b>${d.label}</b><br>${d.quadrant}: <b>${d.score.toFixed(1)}</b> / 5`);
      })
      .on("mouseleave", hideTT);

    // -----------------------------
    // Centre circle + bold score
    // -----------------------------
    root.append("circle")
      .attr("r", innerR - 10)
      .attr("fill", "rgba(233,238,245,0.05)")
      .attr("stroke", "rgba(233,238,245,0.12)")
      .attr("stroke-width", 1);

    // Overall = average of all segment scores
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
})();
